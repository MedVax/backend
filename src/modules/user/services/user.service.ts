import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import type { Prisma, User } from 'generated/prisma/client';
import { UserStatus } from 'generated/prisma/enums';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { randomUUID } from 'crypto';

import { PrismaTenancyService } from 'modules/prisma-tenancy/prisma-tenancy.service';
import { normalizeString } from 'utils/string-util';
import { CreateUserDto } from '../dtos/create-user.dto';
import { UserCreatedEvent } from '../events/user-created.event';
import { UpdateUserDto } from '../dtos/update-user.dto';
import { UpdateUserProfileDto } from '../dtos/update-user-profile.dto';
import { MailService } from 'src/mail/services/mail.service';
import { USER_CREATED } from '../constants/user-event.constant';
import { AvatarService } from 'services/avatar.service';
import { BcryptService } from 'services/bcrypt.service';
import { PaginationQuery } from 'src/dtos/paginated-query.dto';
import { GetUsersFilterQuery } from '../dtos/get-users-filter-query.dto';
import { isArray } from 'class-validator';
import { QueryFilter, QueryOptions } from 'libs/url-to-db-query';
import { UserExpanded } from '../types/user';
import { populateRole } from 'modules/roles/helpers/roles.helper';
import { excludeKeys } from 'utils/object-util';

@Injectable()
export class UserService {
  constructor(
    private prismaService: PrismaTenancyService,
    private eventEmitter: EventEmitter2,
    private mailService: MailService,
    private avatarService: AvatarService,
    private bcryptService: BcryptService,
  ) {}
  private logger = new Logger(this.constructor.name);

  countWithUrlQuery(
    filter?: QueryFilter<UserExpanded>,
    options?: QueryOptions<UserExpanded>,
  ) {
    return this.prismaService.tenancy.user.countWithUrlQuery(filter, options);
  }

  async getAllWithUrlQuery(
    filter?: QueryFilter<UserExpanded>,
    options?: QueryOptions<UserExpanded>,
  ) {
    return this.prismaService.tenancy.user.findManyWithUrlQuery(
      filter,
      options,
    );
  }

  getWithUrlQuery(id: string, options?: QueryOptions<UserExpanded>) {
    return this.prismaService.tenancy.user.findFirstWithUrlQuery(
      { id },
      options,
    );
  }

  async getOrThrowWithUrlQuery(
    id: string,
    options?: QueryOptions<UserExpanded>,
  ) {
    const user = await this.getWithUrlQuery(id, options);
    if (!user) {
      throw new NotFoundException(`Can't find user with id "${id}"`);
    }
    return user;
  }

  get(idOrEmail: string) {
    return this.prismaService.tenancy.user.findFirst({
      where: {
        OR: [
          ...(idOrEmail ? [{ id: idOrEmail }] : []),
          { email: normalizeString(String(idOrEmail)) },
        ],
      },
    });
  }

  async getOrThrow(idOrEmail: string) {
    const user = await this.get(idOrEmail);
    if (!user) {
      throw new NotFoundException(
        `Can't find user with id or name or slug "${idOrEmail}"`,
      );
    }
    return user;
  }

  async create(dto: CreateUserDto) {
    const {
      firstName,
      lastName,
      password,
      email,
      type,
      status,
      userRoleIds: roles,
    } = dto;

    // Check if user already exists
    const existingUser = await this.findOne(email);
    if (existingUser) {
      throw new ConflictException('User already exists');
    }

    // Validate role IDs before connecting
    // TODO: convert to a reusable function
    let roleConnections = [];
    if (roles && roles.length > 0) {
      const existingRoles =
        await this.prismaService.corePrismaService.role.findMany({
          where: { id: { in: roles } },
          select: { id: true },
        });

      const validRoleIds = existingRoles.map((role) => role.id);
      const invalidRoles = roles.filter((id) => !validRoleIds.includes(id));

      if (invalidRoles.length > 0) {
        throw new BadRequestException(
          `Invalid role IDs: ${invalidRoles.join(', ')}`,
        );
      }

      roleConnections = validRoleIds.map((roleId) => ({ roleId }));
    }

    // Generate user avatar
    const avatar = this.avatarService.create(randomUUID());

    return await this.prismaService.corePrismaService.$transaction(
      async (prisma) => {
        const user = await prisma.user.create({
          data: {
            type,
            avatar,
            email: normalizeString(email),
            lastName: normalizeString(lastName),
            status: status || UserStatus.ACTIVE,
            firstName: normalizeString(firstName),
            password: this.bcryptService.hashSync(password),
          },
          include: {
            userRoles: true,
          },
        });

        // Step 2: Assign roles (only if roles exist)
        if (roleConnections.length > 0) {
          await prisma.userRole.createMany({
            data: roleConnections.map((role) => ({
              userId: user.id,
              roleId: role.roleId,
            })),
          });
        }

        // Emit user created event
        this.eventEmitter.emit(
          USER_CREATED,
          new UserCreatedEvent(user, password),
        );

        return user;
      },
    );
  }

  async update(dto: UpdateUserDto) {
    const roleIds = dto.roles ? dto.roles : [];
    // Check the user taking the action
    await this.findOneOrThrow(dto?.userId);

    const user = await this.prismaService.corePrismaService.user.update({
      where: { id: dto?.userId },
      data: {
        ...(dto?.firstName
          ? { firstName: normalizeString(dto?.firstName) }
          : {}),
        ...(dto?.lastName ? { lastName: normalizeString(dto?.lastName) } : {}),
        ...(dto?.type ? { type: dto?.type } : {}),
        ...(dto?.status ? { status: dto?.status } : {}),
      },
      include: {
        ...populateRole,
      },
    });

    const userWithoutPassword = excludeKeys(user, ['password']);

    // TODO: find a way to upsert the data instead
    if (Array.isArray(roleIds)) {
      await this.prismaService.corePrismaService.userRole.deleteMany({
        where: { userId: dto.userId },
      });

      if (roleIds.length > 0) {
        await this.prismaService.corePrismaService.userRole.createMany({
          data: roleIds.map((roleId) => ({
            userId: dto.userId,
            roleId,
          })),
        });
      }
    }

    return userWithoutPassword;
  }

  async updateProfile(userId: string, dto: UpdateUserProfileDto) {
    const userExist = await this.findOneOrThrow(userId);
    const updateUser = await this.update({
      ...dto,
      userId,
      type: userExist?.type,
      ...(dto?.roles ? { roleIds: dto?.roles } : {}),
    });
    return updateUser;
  }

  async getUsers(
    paginationQueryParams: PaginationQuery,
    filterQueryParams: GetUsersFilterQuery,
  ) {
    const { search, type } = filterQueryParams;
    const where: Prisma.UserWhereInput = {
      AND: [
        search
          ? {
              OR: [
                search
                  ? { firstName: { contains: search, mode: 'insensitive' } }
                  : {},
                search
                  ? { lastName: { contains: search, mode: 'insensitive' } }
                  : {},
                search
                  ? { email: { contains: search, mode: 'insensitive' } }
                  : {},
              ],
            }
          : {},
        type
          ? {
              ...(isArray(type)
                ? { OR: type?.map((type) => ({ type })) }
                : { type }),
            }
          : {},
      ],
    };
    const users = await this.prismaService.tenancy.user.paginate({
      where,
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        lastLoginAt: true,
        status: true,
        type: true,
        createdAt: true,
        avatar: true,
        ...populateRole,
      },
      orderBy: { createdAt: 'desc' },
      ...paginationQueryParams,
    });

    return users;
  }

  // NOTE
  async getUser(id: string) {
    const user = await this.findOneOrThrow(id, {
      include: {
        ...populateRole,
      },
    });
    return user;
  }

  async findOne<T extends User>(
    identifier: string,
    extraArgs?: Prisma.UserFindFirstArgs,
  ) {
    if (!identifier) {
      throw new BadRequestException('Invalid User Identifier');
    }
    try {
      const user = await this.prismaService.corePrismaService.user.findFirst({
        where: {
          OR: [{ email: identifier }, identifier ? { id: identifier } : {}],
        },
        ...extraArgs,
      });

      return user as T;
    } catch (error) {
      this.logger.error(error);
      return null;
    }
  }

  async findOneOrThrow<T extends User>(
    identifier: string,
    extraArgs?: Prisma.UserFindFirstArgs,
  ) {
    const user = await this.findOne(identifier, extraArgs);
    if (!user) throw new NotFoundException('User is unavailable');

    return user as T;
  }
}

export default UserService;
