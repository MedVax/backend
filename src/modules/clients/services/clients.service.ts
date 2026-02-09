import {
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import type { Prisma, User, UserProfileClient } from 'generated/prisma/client';
import { UserProfileType, UserType } from 'generated/prisma/enums';
import { PrismaTenancyService } from 'modules/prisma-tenancy/prisma-tenancy.service';
import { CreateClientDto } from '../dtos/create-client.dto';
import { UpdateClientDto } from '../dtos/update-client.dto';
import { PaginationQuery } from 'src/dtos/paginated-query.dto';
import { normalizeString } from 'utils/string-util';
import { BcryptService } from 'services/bcrypt.service';
import { AuthUserType } from 'types/user.types';

@Injectable()
export class ClientsService {
  constructor(
    private prismaService: PrismaTenancyService,
    private bcryptService: BcryptService,
  ) {}

  private logger = new Logger(ClientsService.name);

  async create(dto: CreateClientDto): Promise<User> {
    this.logger.log(`Creating client account for email: ${dto.email}`);

    const existingUser = await this.prismaService.tenancy.user.findFirst({
      where: { email: normalizeString(dto.email) },
    });

    if (existingUser) {
      this.logger.warn(
        `Client creation failed: email ${dto.email} already exists`,
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
            type: UserProfileType.CLIENT,
            userProfileClients: {
              create: {
                coverName: dto.coverName,
                referral: dto.referral,
                useCoverName: dto.useCoverName,
              },
            },
          },
        },
      },
      include: {
        userProfiles: {
          include: {
            user: true,
            userProfileClients: true,
          },
        },
      },
    });

    const clientProfile = user?.userProfiles?.find(
      (profile) => profile.type === UserProfileType.CLIENT,
    )?.userProfileClients[0];

    if (clientProfile) {
      this.logger.log(
        `Client account created successfully - ID: ${clientProfile.id}, Email: ${user.email}`,
      );
    }

    return user;
  }

  async findAll(paginationQuery?: PaginationQuery) {
    const where: Prisma.UserProfileClientWhereInput = {
      deletedAt: null,
    };

    return this.prismaService.tenancy.userProfileClient.paginate({
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
        userProfileConsultant: {
          select: {
            id: true,
            jobTitle: true,
            bio: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      ...paginationQuery,
    });
  }

  async findOne(id: string): Promise<UserProfileClient | null> {
    return this.prismaService.tenancy.userProfileClient.findFirst({
      where: {
        OR: [{ id }, { userProfileId: id }],
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
        userProfileConsultant: {
          select: {
            id: true,
            jobTitle: true,
            bio: true,
          },
        },
      },
    });
  }

  async findOneOrThrow(id: string): Promise<UserProfileClient> {
    const client = await this.findOne(id);
    if (!client) {
      throw new NotFoundException(`Client profile with id "${id}" not found`);
    }
    return client;
  }

  async findByUserId(userId: string): Promise<UserProfileClient | null> {
    return this.prismaService.tenancy.userProfileClient.findFirst({
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
        userProfileConsultant: {
          select: {
            id: true,
            jobTitle: true,
            bio: true,
          },
        },
      },
    });
  }

  async update(user: AuthUserType, dto: UpdateClientDto) {
    const id = dto.id;

    if (
      user.activeProfile?.type === UserProfileType.CLIENT &&
      user.activeProfile?.userProfileClient !== id
    ) {
      throw new ForbiddenException(
        'You are not authorized to update this client profile',
      );
    }

    const clientProfileExist =
      await this.prismaService.tenancy.userProfileClient.findFirst({
        where: {
          id,
          deletedAt: null,
        },
        include: {
          userProfile: {
            include: {
              user: true,
            },
          },
        },
      });

    if (!clientProfileExist) {
      throw new NotFoundException(`Client profile with id "${id}" not found`);
    }

    await this.prismaService.corePrismaService.user.update({
      where: { id: clientProfileExist.userProfile.userId },
      data: {
        ...(dto.firstName !== undefined ? { firstName: dto.firstName } : {}),
        ...(dto.lastName !== undefined ? { lastName: dto.lastName } : {}),
        ...(dto.password !== undefined
          ? { password: this.bcryptService.hashSync(dto.password) }
          : {}),
      },
      include: {
        userProfiles: true,
      },
    });

    if (!clientProfileExist) {
      throw new NotFoundException(`Client profile with id "${id}" not found`);
    }

    const updatedClientProfile =
      await this.prismaService.tenancy.userProfileClient.update({
        where: { id: clientProfileExist.id },
        data: {
          ...(dto.coverName !== undefined ? { coverName: dto.coverName } : {}),
          ...(dto.referral !== undefined ? { referral: dto.referral } : {}),
          ...(dto.useCoverName !== undefined
            ? { useCoverName: dto.useCoverName }
            : {}),
          ...(dto.userProfileConsultantId !== undefined
            ? {
                userProfileConsultant: dto.userProfileConsultantId
                  ? { connect: { id: dto.userProfileConsultantId } }
                  : { disconnect: true },
              }
            : {}),
        },
        include: {
          userProfile: true,
        },
      });

    return updatedClientProfile;
  }

  async remove(id: string): Promise<UserProfileClient> {
    await this.findOneOrThrow(id);

    // Soft delete by setting deletedAt
    return this.prismaService.tenancy.userProfileClient.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  /**
   * Assign or change consultant for a client
   */
  async assignConsultant(
    clientId: string,
    consultantId?: string | null,
  ): Promise<UserProfileClient> {
    await this.findOneOrThrow(clientId);

    if (consultantId) {
      this.logger.log(
        `Assigning consultant ${consultantId} to client ${clientId}`,
      );

      const consultant =
        await this.prismaService.tenancy.userProfileConsultant.findFirst({
          where: {
            id: consultantId,
            deletedAt: null,
          },
        });

      if (!consultant) {
        this.logger.warn(
          `Consultant assignment failed: consultant ${consultantId} not found`,
        );
        throw new NotFoundException(
          `Consultant with ID "${consultantId}" not found`,
        );
      }
    } else {
      this.logger.log(`Removing consultant assignment from client ${clientId}`);
    }

    // Update client with new consultant assignment
    const updatedClient =
      await this.prismaService.tenancy.userProfileClient.update({
        where: { id: clientId },
        data: {
          userProfileConsultantId: consultantId || null,
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
          userProfileConsultant: consultantId
            ? {
                select: {
                  id: true,
                  jobTitle: true,
                  bio: true,
                  rate: true,
                  areaOfExpertise: true,
                  yearsOfExperience: true,
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
              }
            : undefined,
        },
      });

    this.logger.log(
      `Consultant ${consultantId ? `assigned to` : 'removed from'} client - ClientID: ${clientId}, ConsultantID: ${consultantId || 'N/A'}`,
    );

    return updatedClient;
  }
}
