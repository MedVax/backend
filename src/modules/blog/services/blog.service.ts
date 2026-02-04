import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaTenancyService } from 'modules/prisma-tenancy/prisma-tenancy.service';
import { CreateBlogPostDto } from '../dtos/create-blog-post.dto';
import { UpdateBlogPostDto } from '../dtos/update-blog-post.dto';
import { GetBlogPostsFilterQuery } from '../dtos/get-blog-posts-filter-query.dto';
import { PaginationQuery } from 'src/dtos/paginated-query.dto';
import { slugify } from 'src/utils/string-util';
import type { Prisma } from 'generated/prisma/client';
import { UploadsService } from 'src/uploads/uploads.service';
import { RedisService } from 'services/redis.service';
import { randomUUID } from 'crypto';

// Cache configuration
const CACHE_TTL = 3600; // 1 hour
const CACHE_PREFIX = {
  BLOG_POST: 'blog:post:',
  BLOG_POST_BY_ID: 'blog:post:id:',
  BLOG_POST_BY_SLUG: 'blog:post:slug:',
  BLOG_POST_LIST: 'blog:post:list:',
  BLOG_POST_TOP: 'blog:post:top:',
};

@Injectable()
export class BlogService {
  private logger = new Logger(BlogService.name);

  constructor(
    private prismaService: PrismaTenancyService,
    private uploadsService: UploadsService,
    private redisService: RedisService,
  ) {}

  async create(
    dto: CreateBlogPostDto,
    authorId: string,
    file?: Express.Multer.File,
  ) {
    // Upload image if provided
    let imageUrl = dto.image;
    if (file) {
      const fileName = `blog/${authorId}/${randomUUID()}-${file.originalname}`;
      imageUrl = await this.uploadsService.initialize(
        file.buffer,
        fileName,
        {
          ContentType: file.mimetype,
          CacheControl: 'max-age=31536000', // 1 year cache
        },
        true, // Optimize image
      );
    }

    // Generate slug from title if not provided
    let slug = dto.slug || slugify(dto.title);

    // Ensure slug is unique
    const existingPost = await this.prismaService.tenancy.blogPost.findUnique({
      where: { slug },
    });

    if (existingPost) {
      let counter = 1;
      let newSlug = `${slug}-${counter}`;
      while (
        await this.prismaService.tenancy.blogPost.findUnique({
          where: { slug: newSlug },
        })
      ) {
        counter++;
        newSlug = `${slug}-${counter}`;
      }
      slug = newSlug;
    }

    // Set publishedAt if published is true and publishedAt is not provided
    const publishedAt = dto.publishedAt || (dto.published ? new Date() : null);

    const post = await this.prismaService.tenancy.blogPost.create({
      data: {
        title: dto.title,
        slug,
        image: imageUrl,
        content: dto.content,
        excerpt: dto.excerpt,
        authorId,
        published: dto.published || false,
        publishedAt,
        metaTitle: dto.metaTitle || dto.title,
        metaDescription: dto.metaDescription || dto.excerpt,
        ...(dto.tags && {
          tags: Array.isArray(dto.tags) ? dto.tags : [dto.tags],
        }),
      },
      include: {
        author: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            avatar: true,
          },
        },
      },
    });

    // Invalidate cache
    await Promise.all([
      this.redisService.deleteByPattern(`${CACHE_PREFIX.BLOG_POST_LIST}*`),
      this.redisService.deleteByPattern(`${CACHE_PREFIX.BLOG_POST_TOP}*`),
    ]);

    return post;
  }

  async findAll(
    paginationQueryParams: PaginationQuery,
    filterQueryParams: GetBlogPostsFilterQuery,
  ) {
    const { search, published, authorId, tag } = filterQueryParams;
    const { skip, take } = paginationQueryParams;

    // Build cache key from query parameters
    const cacheKey = `${CACHE_PREFIX.BLOG_POST_LIST}${JSON.stringify({
      skip,
      take,
      search,
      published,
      authorId,
      tag,
    })}`;

    // Check cache first
    const cached = await this.redisService.get<any>(cacheKey);
    if (cached) {
      return cached;
    }

    const where: Prisma.BlogPostWhereInput = {
      AND: [
        published !== undefined ? { published } : {},
        authorId ? { authorId } : {},
        tag ? { tags: { has: tag } } : {},
        search
          ? {
              OR: [
                { title: { contains: search, mode: 'insensitive' } },
                { excerpt: { contains: search, mode: 'insensitive' } },
                { content: { contains: search, mode: 'insensitive' } },
              ],
            }
          : {},
      ],
    };

    const result = await this.prismaService.tenancy.blogPost.paginate({
      where,
      include: {
        author: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            avatar: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      ...paginationQueryParams,
    });

    // Cache the result
    await this.redisService.set(cacheKey, result, CACHE_TTL);

    return result;
  }

  async findOne(id: string) {
    const cacheKey = `${CACHE_PREFIX.BLOG_POST_BY_ID}${id}`;

    // Check cache first
    const cached = await this.redisService.get<any>(cacheKey);
    if (cached) {
      return cached;
    }

    const post = await this.prismaService.tenancy.blogPost.findUnique({
      where: { id },
      include: {
        author: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            avatar: true,
          },
        },
      },
    });

    if (!post) {
      throw new NotFoundException(`Blog post with ID ${id} not found`);
    }

    // Cache the result
    await this.redisService.set(cacheKey, post, CACHE_TTL);

    return post;
  }

  async findBySlug(slug: string) {
    const cacheKey = `${CACHE_PREFIX.BLOG_POST_BY_SLUG}${slug}`;

    // Check cache first
    const cached = await this.redisService.get<any>(cacheKey);
    if (cached) {
      // Increment views in background (don't wait for it)
      this.prismaService.tenancy.blogPost
        .update({
          where: { id: cached.id },
          data: { views: { increment: 1 } },
        })
        .catch((err) => {
          this.logger.error(
            `Failed to increment views for post ${cached.id}:`,
            err,
          );
        });

      return {
        ...cached,
        views: cached.views + 1,
      };
    }

    const post = await this.prismaService.tenancy.blogPost.findFirst({
      where: {
        slug,
        published: true, // Only return published posts for public viewing
      },
      include: {
        author: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            avatar: true,
          },
        },
      },
    });

    if (!post) {
      throw new NotFoundException(`Blog post with slug ${slug} not found`);
    }

    // Increment views
    await this.prismaService.tenancy.blogPost.update({
      where: { id: post.id },
      data: { views: { increment: 1 } },
    });

    const result = {
      ...post,
      views: post.views + 1,
    };

    // Cache the result
    await this.redisService.set(cacheKey, result, CACHE_TTL);

    return result;
  }

  async update(
    id: string,
    dto: UpdateBlogPostDto,
    userId?: string,
    file?: Express.Multer.File,
  ) {
    const existingPost = await this.prismaService.tenancy.blogPost.findUnique({
      where: { id },
    });

    if (!existingPost) {
      throw new NotFoundException(`Blog post with ID ${id} not found`);
    }

    // Check if user is the author or admin
    if (userId && existingPost.authorId !== userId) {
      const user = await this.prismaService.tenancy.user.findUnique({
        where: { id: userId },
        select: { type: true },
      });

      if (!user || (user.type !== 'ADMIN' && user.type !== 'SUPER_ADMIN')) {
        throw new BadRequestException(
          'You can only update your own blog posts',
        );
      }
    }

    // Handle image upload if provided
    let imageUrl = dto.image;
    if (file && existingPost.authorId) {
      const fileName = `blog/${existingPost.authorId}/${randomUUID()}-${file.originalname}`;
      imageUrl = await this.uploadsService.initialize(
        file.buffer,
        fileName,
        {
          ContentType: file.mimetype,
          CacheControl: 'max-age=31536000', // 1 year cache
        },
        true, // Optimize image
      );
    }

    // Handle slug update
    let slug = dto.slug;
    if (dto.title && !dto.slug) {
      slug = slugify(dto.title);
      // Check if new slug conflicts with existing posts
      const conflictingPost =
        await this.prismaService.tenancy.blogPost.findFirst({
          where: {
            slug,
            id: { not: id },
          },
        });

      if (conflictingPost) {
        let counter = 1;
        let newSlug = `${slug}-${counter}`;
        while (
          await this.prismaService.tenancy.blogPost.findFirst({
            where: {
              slug: newSlug,
              id: { not: id },
            },
          })
        ) {
          counter++;
          newSlug = `${slug}-${counter}`;
        }
        slug = newSlug;
      }
    }

    // Handle publishedAt update
    let publishedAt = dto.publishedAt
      ? new Date(dto.publishedAt)
      : existingPost.publishedAt;

    if (dto.published !== undefined) {
      if (dto.published && !existingPost.published && !publishedAt) {
        publishedAt = new Date();
      } else if (!dto.published) {
        publishedAt = null;
      }
    }

    const updateData: Prisma.BlogPostUpdateInput = {
      ...(dto.title && { title: dto.title }),
      ...(slug && { slug }),
      ...(imageUrl !== undefined && { image: imageUrl }),
      ...(dto.content && { content: dto.content }),
      ...(dto.excerpt !== undefined && { excerpt: dto.excerpt }),
      ...(dto.published !== undefined && { published: dto.published }),
      ...(publishedAt !== undefined && { publishedAt }),
      ...(dto.metaTitle !== undefined && { metaTitle: dto.metaTitle }),
      ...(dto.metaDescription !== undefined && {
        metaDescription: dto.metaDescription,
      }),
      ...(dto.tags !== undefined && { tags: dto.tags }),
    };

    const post = await this.prismaService.tenancy.blogPost.update({
      where: { id },
      data: updateData,
      include: {
        author: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            avatar: true,
          },
        },
      },
    });

    // Invalidate cache
    await Promise.all([
      this.redisService.delete(`${CACHE_PREFIX.BLOG_POST_BY_ID}${id}`),
      this.redisService.delete(
        `${CACHE_PREFIX.BLOG_POST_BY_SLUG}${existingPost.slug}`,
      ),
      ...(slug && slug !== existingPost.slug
        ? [this.redisService.delete(`${CACHE_PREFIX.BLOG_POST_BY_SLUG}${slug}`)]
        : []),
      this.redisService.deleteByPattern(`${CACHE_PREFIX.BLOG_POST_LIST}*`),
      this.redisService.deleteByPattern(`${CACHE_PREFIX.BLOG_POST_TOP}*`),
    ]);

    return post;
  }

  async remove(id: string, userId?: string) {
    const post = await this.prismaService.tenancy.blogPost.findUnique({
      where: { id },
    });

    if (!post) {
      throw new NotFoundException(`Blog post with ID ${id} not found`);
    }

    // Check if user is the author or admin
    if (userId && post.authorId !== userId) {
      const user = await this.prismaService.tenancy.user.findUnique({
        where: { id: userId },
        select: { type: true },
      });

      if (!user || (user.type !== 'ADMIN' && user.type !== 'SUPER_ADMIN')) {
        throw new BadRequestException(
          'You can only delete your own blog posts',
        );
      }
    }

    await this.prismaService.tenancy.blogPost.delete({
      where: { id },
    });

    // Invalidate cache
    await Promise.all([
      this.redisService.delete(`${CACHE_PREFIX.BLOG_POST_BY_ID}${id}`),
      this.redisService.delete(`${CACHE_PREFIX.BLOG_POST_BY_SLUG}${post.slug}`),
      this.redisService.deleteByPattern(`${CACHE_PREFIX.BLOG_POST_LIST}*`),
      this.redisService.deleteByPattern(`${CACHE_PREFIX.BLOG_POST_TOP}*`),
    ]);

    return { success: true };
  }

  async getTopPosts(limit: number = 10) {
    const cacheKey = `${CACHE_PREFIX.BLOG_POST_TOP}${limit}`;

    // Check cache first
    const cached = await this.redisService.get<any[]>(cacheKey);
    if (cached) {
      return cached;
    }

    const posts = await this.prismaService.tenancy.blogPost.findMany({
      where: {
        published: true,
      },
      include: {
        author: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            avatar: true,
          },
        },
      },
      orderBy: [
        { views: 'desc' },
        { publishedAt: 'desc' },
        { createdAt: 'desc' },
      ],
      take: limit,
    });

    // Cache the result
    await this.redisService.set(cacheKey, posts, CACHE_TTL);

    return posts;
  }
}
