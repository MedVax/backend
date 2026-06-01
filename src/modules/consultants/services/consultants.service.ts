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
import { UpdateConsultantStatusDto } from '../dtos/update-consultant-status.dto';
import { PaginationQuery } from 'src/dtos/paginated-query.dto';
import { normalizeString } from 'utils/string-util';
import { BcryptService } from 'services/bcrypt.service';
import { MailService } from 'src/mail/services/mail.service';
import { AuthUserType } from 'types/user.types';

@Injectable()
export class ConsultantsService {
  constructor(
    private prismaService: PrismaTenancyService,
    private bcryptService: BcryptService,
    private mailService: MailService,
  ) { }

  private logger = new Logger(ConsultantsService.name);

  async create(dto: CreateConsultantDto): Promise<UserProfileConsultant> {
    this.logger.log(`Creating consultant account for email: ${dto.email}`);

    const existingUser = await this.prismaService.tenancy.user.findFirst({
      where: { email: normalizeString(dto.email) },
    });

    if (existingUser) {
      this.logger.warn(
        `Consultant creation failed: email ${dto.email} already exists`,
      );
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

    if (consultantProfile) {
      this.logger.log(
        `Consultant account created successfully - ID: ${consultantProfile.id}, Email: ${user.email}, Rate: ${dto.rate || 'N/A'}`,
      );
    }

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
                status: true,
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
                status: true,
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
                status: true,
              },
            },
          },
        },
      },
    });
  }

  async update(
    user: AuthUserType,
    dto: UpdateConsultantDto,
  ): Promise<UserProfileConsultant> {
    const id = dto.id;
    this.logger.log(`Updating consultant profile - ID: ${id}`);

    // if (user.activeProfile?.type === UserProfileType.CONSULTANT && user.activeProfile?.userProfileConsultant !== id) {
    //   throw new ForbiddenException('You are not authorized to update this consultant profile');
    // }

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
                status: true,
              },
            },
          },
        },
      },
    });
  }

  async remove(id: string): Promise<UserProfileConsultant> {
    await this.findOneOrThrow(id);
    this.logger.log(`Soft deleting consultant profile - ID: ${id}`);

    return this.prismaService.tenancy.userProfileConsultant.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  async updateStatus(id: string, dto: UpdateConsultantStatusDto) {
    const consultant = await this.findOneOrThrow(id);
    this.logger.log(
      `Updating status for consultant profile ${id} to ${dto.status}`,
    );

    const userId = (consultant as any).userProfile?.user?.id;
    if (!userId) {
      throw new NotFoundException(
        'Could not resolve user for this consultant profile',
      );
    }

    const updatedUser = await this.prismaService.corePrismaService.user.update({
      where: { id: userId },
      data: { status: dto.status },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        avatar: true,
        status: true,
      },
    });

    this.logger.log(
      `Consultant ${id} (user ${userId}) status updated to ${dto.status}`,
    );

    return updatedUser;
  }
}
