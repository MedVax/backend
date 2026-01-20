import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import type { Prisma, UserProfileConsultant } from 'generated/prisma/client';
import { UserProfileType, UserType } from 'generated/prisma/enums';
import { PrismaTenancyService } from 'modules/prisma-tenancy/prisma-tenancy.service';
import { CreateConsultantDto } from '../dtos/create-consultant.dto';
import { UpdateConsultantDto } from '../dtos/update-consultant.dto';
import { PaginationQuery } from 'src/dtos/paginated-query.dto';
import { normalizeString } from 'utils/string-util';
import { BcryptService } from 'services/bcrypt.service';
import { MailService } from 'src/mail/services/mail.service';

@Injectable()
export class ConsultantsService {
  constructor(
    private prismaService: PrismaTenancyService,
    private bcryptService: BcryptService,
    private mailService: MailService,
  ) {}

  private logger = new Logger(ConsultantsService.name);

  async create(dto: CreateConsultantDto): Promise<UserProfileConsultant> {
    const existingUser = await this.prismaService.tenancy.user.findFirst({
      where: { email: normalizeString(dto.email) },
    });

    if (existingUser) {
      throw new ConflictException(
        `User with email "${dto.email}" already exists`,
      );
    }

    const user = await this.prismaService.corePrismaService.user.create({
      data: {
        email: normalizeString(dto.email),
        password: this.bcryptService.hashSync(dto.password),
        firstName: normalizeString(dto.firstName),
        lastName: normalizeString(dto.lastName),
        type: UserType.USER,
        userProfiles: {
          create: {
            type: UserProfileType.CONSULTANT,
            userProfileConsultants: {
              create: {
                introVideo: dto.introVideo,
                bio: dto.bio,
                rate: dto.rate,
                jobTitle: dto.jobTitle,
                areaOfExpertise: dto.areaOfExpertise || [],
                yearsOfExperience: dto.yearsOfExperience,
                faith: dto.faith,
                availabilityPeriod: dto.availabilityPeriod,
                offerFaithTherapy: dto.offerFaithTherapy,
                hasSetAvailability: dto.hasSetAvailability ?? false,
              },
            },
          },
        },
      },
      include: {
        userProfiles: {
          include: {
            userProfileConsultants: true,
          },
        },
      },
    });

    const consultantProfile = user?.userProfiles?.find(
      (profile) => profile.type === UserProfileType.CONSULTANT,
    )?.userProfileConsultants[0];

    // Send welcome email to consultant
    if (consultantProfile && user.email) {
      try {
        const loginUrl =
          process.env.FRONTEND_URL || 'https://app.medvax.com/login';
        const supportEmail = process.env.SUPPORT_EMAIL || 'support@medvax.com';

        await this.mailService.consultantAccountCreated({
          to: user.email,
          context: {
            firstName: user.firstName,
            lastName: user.lastName,
            email: user.email,
            password: dto.password,
            loginUrl,
            supportEmail,
          },
        });

        this.logger.log(`Welcome email sent to consultant: ${user.email}`);
      } catch (error) {
        this.logger.error(
          `Failed to send welcome email to consultant ${user.email}: ${error.message}`,
        );
        // Don't throw - email failure shouldn't break account creation
      }
    }

    return consultantProfile;
  }

  async findAll(paginationQuery: PaginationQuery) {
    const where: Prisma.UserProfileConsultantWhereInput = {
      deletedAt: null,
    };

    return this.prismaService.tenancy.userProfileConsultant.paginate({
      where,
      include: {
        userProfile: {
          include: {
            user: {
              select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
                avatar: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      ...paginationQuery,
    });
  }

  async findOne(id: string): Promise<UserProfileConsultant | null> {
    return this.prismaService.tenancy.userProfileConsultant.findFirst({
      where: {
        id,
        deletedAt: null,
      },
      include: {
        userProfile: {
          include: {
            user: {
              select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
                avatar: true,
              },
            },
          },
        },
      },
    });
  }

  async findOneOrThrow(id: string): Promise<UserProfileConsultant> {
    const consultant = await this.findOne(id);
    if (!consultant) {
      throw new NotFoundException(
        `Consultant profile with id "${id}" not found`,
      );
    }
    return consultant;
  }

  async findByUserId(userId: string): Promise<UserProfileConsultant | null> {
    return this.prismaService.tenancy.userProfileConsultant.findFirst({
      where: {
        userProfile: {
          userId,
        },
        deletedAt: null,
      },
      include: {
        userProfile: {
          include: {
            user: {
              select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
                avatar: true,
              },
            },
          },
        },
      },
    });
  }

  async update(
    id: string,
    dto: UpdateConsultantDto,
  ): Promise<UserProfileConsultant> {
    return this.prismaService.tenancy.userProfileConsultant.update({
      where: { id },
      data: {
        ...(dto.introVideo !== undefined ? { introVideo: dto.introVideo } : {}),
        ...(dto.bio !== undefined ? { bio: dto.bio } : {}),
        ...(dto.rate !== undefined ? { rate: dto.rate } : {}),
        ...(dto.jobTitle !== undefined ? { jobTitle: dto.jobTitle } : {}),
        ...(dto.areaOfExpertise !== undefined
          ? { areaOfExpertise: dto.areaOfExpertise }
          : {}),
        ...(dto.yearsOfExperience !== undefined
          ? { yearsOfExperience: dto.yearsOfExperience }
          : {}),
        ...(dto.faith !== undefined ? { faith: dto.faith } : {}),
        ...(dto.availabilityPeriod !== undefined
          ? { availabilityPeriod: dto.availabilityPeriod }
          : {}),
        ...(dto.offerFaithTherapy !== undefined
          ? { offerFaithTherapy: dto.offerFaithTherapy }
          : {}),
        ...(dto.hasSetAvailability !== undefined
          ? { hasSetAvailability: dto.hasSetAvailability }
          : {}),
        userProfile: {
          update: {
            user: {
              update: {
                ...(dto.firstName !== undefined
                  ? { firstName: dto.firstName }
                  : {}),
                ...(dto.lastName !== undefined
                  ? { lastName: dto.lastName }
                  : {}),
                ...(dto.password !== undefined
                  ? { password: this.bcryptService.hashSync(dto.password) }
                  : {}),
              },
            },
          },
        },
      },
      include: {
        userProfile: {
          include: {
            user: {
              select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
                avatar: true,
              },
            },
          },
        },
      },
    });
  }

  async remove(id: string): Promise<UserProfileConsultant> {
    await this.findOneOrThrow(id);

    // Soft delete by setting deletedAt
    return this.prismaService.tenancy.userProfileConsultant.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }
}
