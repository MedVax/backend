import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaTenancyService } from 'modules/prisma-tenancy/prisma-tenancy.service';
import {
  AvailabilityType,
  DateLabel,
  AvailabilityPeriod,
} from 'generated/prisma/enums';
import {
  format,
  parseISO,
  addDays,
  startOfDay,
  getDay,
  addHours,
  isAfter,
  setHours,
} from 'date-fns';
import { formatInTimeZone } from 'date-fns-tz';
import { SESSION_BUFFER_HOURS } from '../constants/sessions.constant';

export interface TimeSlot {
  time: string; // ISO string
  isAvailable: boolean;
}

export interface DayAvailability {
  date: string; // YYYY-MM-DD
  dayOfWeek: string;
  timezone: string;
  slots: TimeSlot[];
  intervals: Array<{ start: number; end: number }>;
}

// UpdateAvailabilityDto is now defined in dtos/update-availability.dto.ts
// Keeping this interface for backward compatibility with service methods
export interface UpdateAvailabilityDto {
  timezone: string;
  weekly: {
    monday?: Array<{ start: number; end: number }>;
    tuesday?: Array<{ start: number; end: number }>;
    wednesday?: Array<{ start: number; end: number }>;
    thursday?: Array<{ start: number; end: number }>;
    friday?: Array<{ start: number; end: number }>;
    saturday?: Array<{ start: number; end: number }>;
    sunday?: Array<{ start: number; end: number }>;
  };
  custom?: Array<{
    id?: string;
    date: string; // YYYY-MM-DD
    intervals: Array<{ start: number; end: number }>;
  }>;
}

@Injectable()
export class ProviderAvailabilityService {
  private logger = new Logger(ProviderAvailabilityService.name);

  constructor(private prismaService: PrismaTenancyService) {}

  /**
   * Update provider availability (weekly and custom)
   */
  async updateAvailability(consultantId: string, dto: UpdateAvailabilityDto) {
    const consultant =
      await this.prismaService.tenancy.userProfileConsultant.findUnique({
        where: { id: consultantId },
      });

    if (!consultant) {
      throw new NotFoundException(
        `Consultant with ID ${consultantId} not found`,
      );
    }

    // Validate intervals
    this.validateIntervals(dto);

    // Delete existing weekly availability for this consultant
    await this.prismaService.tenancy.consultantAvailability.deleteMany({
      where: {
        consultantId,
        type: AvailabilityType.WEEKLY,
      },
    });

    // Create weekly availability records
    const dayLabels: DateLabel[] = [
      DateLabel.MONDAY,
      DateLabel.TUESDAY,
      DateLabel.WEDNESDAY,
      DateLabel.THURSDAY,
      DateLabel.FRIDAY,
      DateLabel.SATURDAY,
      DateLabel.SUNDAY,
    ];

    const dayKeys: (keyof typeof dto.weekly)[] = [
      'monday',
      'tuesday',
      'wednesday',
      'thursday',
      'friday',
      'saturday',
      'sunday',
    ];

    for (let i = 0; i < dayLabels.length; i++) {
      const dayKey = dayKeys[i];
      const intervals = dto.weekly[dayKey] || [];

      if (intervals.length > 0) {
        const slots = this.intervalsToSlots(intervals);
        await this.prismaService.tenancy.consultantAvailability.create({
          data: {
            id: `${consultantId}-${dayKey}-${Date.now()}`,
            consultantId,
            type: AvailabilityType.WEEKLY,
            dayOfWeek: dayLabels[i],
            slots,
          },
        });
      }
    }

    // Handle custom availability
    if (dto.custom && dto.custom.length > 0) {
      // Delete existing custom availability for the specified dates
      const customDates = dto.custom.map((c) => c.date).filter((date) => date);

      if (customDates.length > 0) {
        await this.prismaService.tenancy.consultantAvailability.deleteMany({
          where: {
            consultantId,
            type: AvailabilityType.CUSTOM,
            dateString: { in: customDates },
          },
        });
      }

      // Create new custom availability records
      for (const custom of dto.custom) {
        const slots = this.intervalsToSlots(custom.intervals);
        const date = parseISO(custom.date);

        await this.prismaService.tenancy.consultantAvailability.create({
          data: {
            id: custom.id || `${consultantId}-${custom.date}-${Date.now()}`,
            consultantId,
            type: AvailabilityType.CUSTOM,
            dateString: custom.date,
            date,
            slots,
          },
        });
      }
    }

    // Calculate availability period (WEEKDAYS/WEEKENDS/MIXED)
    const availabilityPeriod = this.calculateAvailabilityPeriod(dto.weekly);

    // Update consultant hasSetAvailability flag and timezone
    await this.prismaService.tenancy.userProfileConsultant.update({
      where: { id: consultantId },
      data: {
        hasSetAvailability: true,
        availabilityPeriod,
        timezone: dto.timezone,
      },
    });

    return { success: true };
  }

  /**
   * Get provider availability (for provider's own view)
   */
  async getAvailability(
    consultantId: string,
    date?: string,
  ): Promise<{
    timezone: string;
    weekly: Record<string, Array<{ start: number; end: number }>>;
    custom: Array<{
      id: string;
      date: string;
      intervals: Array<{ start: number; end: number }>;
    }>;
  }> {
    const consultant =
      await this.prismaService.tenancy.userProfileConsultant.findUnique({
        where: { id: consultantId },
      });

    if (!consultant) {
      throw new NotFoundException(
        `Consultant with ID ${consultantId} not found`,
      );
    }

    const weeklyAvailability =
      await this.prismaService.tenancy.consultantAvailability.findMany({
        where: {
          consultantId,
          type: AvailabilityType.WEEKLY,
          deletedAt: null,
        },
      });

    const customAvailability =
      await this.prismaService.tenancy.consultantAvailability.findMany({
        where: {
          consultantId,
          type: AvailabilityType.CUSTOM,
          deletedAt: null,
          ...(date && {
            dateString: { gte: date },
          }),
        },
        orderBy: { date: 'asc' },
      });

    const weekly: Record<string, Array<{ start: number; end: number }>> = {
      monday: [],
      tuesday: [],
      wednesday: [],
      thursday: [],
      friday: [],
      saturday: [],
      sunday: [],
    };

    const dayMap: Record<DateLabel, keyof typeof weekly> = {
      MONDAY: 'monday',
      TUESDAY: 'tuesday',
      WEDNESDAY: 'wednesday',
      THURSDAY: 'thursday',
      FRIDAY: 'friday',
      SATURDAY: 'saturday',
      SUNDAY: 'sunday',
    };

    for (const avail of weeklyAvailability) {
      if (avail.dayOfWeek) {
        const dayKey = dayMap[avail.dayOfWeek];
        if (dayKey) {
          weekly[dayKey] = this.slotsToIntervals(avail.slots);
        }
      }
    }

    const custom = customAvailability.map((avail) => ({
      id: avail.id,
      date: avail.dateString || format(avail.date || new Date(), 'yyyy-MM-dd'),
      intervals: this.slotsToIntervals(avail.slots),
    }));

    return {
      timezone: consultant.timezone || 'Africa/Lagos', // Return consultant's saved timezone
      weekly,
      custom,
    };
  }

  /**
   * Get available slots for a consultant (for clients)
   * Returns dates with available slots, excluding already booked sessions
   */
  async getForProvider(
    consultantId: string,
    referenceDate?: string,
    bufferHours: number = SESSION_BUFFER_HOURS,
  ): Promise<DayAvailability[]> {
    const consultant =
      await this.prismaService.tenancy.userProfileConsultant.findUnique({
        where: { id: consultantId },
        select: {
          id: true,
          hasSetAvailability: true,
          timezone: true,
        },
      });

    if (!consultant) {
      throw new NotFoundException(
        `Consultant with ID ${consultantId} not found`,
      );
    }

    if (!consultant.hasSetAvailability) {
      return [];
    }

    const timezone = consultant.timezone || 'Africa/Lagos'; // Get from consultant's saved timezone
    const refDate = referenceDate
      ? parseISO(referenceDate)
      : startOfDay(new Date());

    // Get weekly and custom availability
    const weeklyAvailability =
      await this.prismaService.tenancy.consultantAvailability.findMany({
        where: {
          consultantId,
          type: AvailabilityType.WEEKLY,
          deletedAt: null,
        },
      });

    // Get booked sessions for the next 30 days
    const startDate = refDate;
    const endDate = addDays(startDate, 30);

    const bookedSessions = await this.prismaService.tenancy.session.findMany({
      where: {
        consultantId,
        scheduledDate: {
          gte: startDate,
          lte: endDate,
        },
        status: {
          notIn: ['CANCELED', 'DECLINED'],
        },
        deleted: false,
      },
      select: {
        scheduledDateString: true,
        scheduledDate: true,
      },
    });

    const bookedSlotsSet = new Set(
      bookedSessions.map((s) => s.scheduledDateString),
    );

    // Generate available slots for next 30 days
    const availableDays: DayAvailability[] = [];
    const dayLabels: DateLabel[] = [
      DateLabel.MONDAY,
      DateLabel.TUESDAY,
      DateLabel.TUESDAY,
      DateLabel.WEDNESDAY,
      DateLabel.WEDNESDAY,
      DateLabel.WEDNESDAY,
      DateLabel.THURSDAY,
      DateLabel.THURSDAY,
      DateLabel.THURSDAY,
      DateLabel.FRIDAY,
      DateLabel.FRIDAY,
      DateLabel.FRIDAY,
      DateLabel.SATURDAY,
      DateLabel.SATURDAY,
      DateLabel.SUNDAY,
      DateLabel.SUNDAY,
    ];

    for (let i = 0; i < 30; i++) {
      const currentDate = addDays(startDate, i);
      const dateString = format(currentDate, 'yyyy-MM-dd');
      const dayOfWeek = getDay(currentDate);
      const dayLabel = dayLabels[dayOfWeek] || DateLabel.MONDAY;

      // Check if there's custom availability for this date
      const customAvail =
        await this.prismaService.tenancy.consultantAvailability.findFirst({
          where: {
            consultantId,
            type: AvailabilityType.CUSTOM,
            dateString,
            deletedAt: null,
          },
        });

      let intervals: Array<{ start: number; end: number }> = [];

      if (customAvail) {
        // Use custom availability
        intervals = this.slotsToIntervals(customAvail.slots);
      } else {
        // Use weekly availability
        const weeklyAvail = weeklyAvailability.find(
          (a) => a.dayOfWeek === dayLabel,
        );
        if (weeklyAvail) {
          intervals = this.slotsToIntervals(weeklyAvail.slots);
        }
      }

      if (intervals.length === 0) {
        continue; // No availability for this day
      }

      // Generate time slots from intervals
      const slots: TimeSlot[] = [];
      const now = new Date();
      const bufferDate = addHours(now, bufferHours);

      for (const interval of intervals) {
        for (let hour = interval.start; hour < interval.end; hour++) {
          const slotDate = setHours(startOfDay(currentDate), hour);
          const slotDateString = formatInTimeZone(
            slotDate,
            timezone,
            "yyyy-MM-dd'T'HH:mm:ss",
          );
          const slotISO = formatInTimeZone(
            slotDate,
            timezone,
            "yyyy-MM-dd'T'HH:mm:ss'Z'",
          );

          // Check buffer time
          if (!isAfter(slotDate, bufferDate)) {
            continue; // Slot too soon
          }

          // Check if slot is booked
          const isBooked = bookedSlotsSet.has(slotDateString);

          slots.push({
            time: slotISO,
            isAvailable: !isBooked,
          });
        }
      }

      // Only add day if there are available slots
      const availableSlots = slots.filter((s) => s.isAvailable);
      if (availableSlots.length > 0) {
        availableDays.push({
          date: dateString,
          dayOfWeek: format(currentDate, 'EEEE'),
          timezone,
          slots: availableSlots,
          intervals,
        });
      }
    }

    return availableDays;
  }

  /**
   * Check if a specific slot is available for booking
   */
  async isSlotAvailable(
    consultantId: string,
    timeslotAsIsoString: string,
    bufferHours: number = SESSION_BUFFER_HOURS,
  ): Promise<boolean> {
    const slotDate = parseISO(timeslotAsIsoString);
    const dateString = format(slotDate, 'yyyy-MM-dd');
    const hour = slotDate.getHours();

    // Check buffer time
    const now = new Date();
    const bufferDate = addHours(now, bufferHours);
    if (!isAfter(slotDate, bufferDate)) {
      return false;
    }

    // Check if consultant has set availability
    const consultant =
      await this.prismaService.tenancy.userProfileConsultant.findUnique({
        where: { id: consultantId },
        select: { hasSetAvailability: true },
      });

    if (!consultant || !consultant.hasSetAvailability) {
      return false;
    }

    // Check for custom availability first
    const customAvail =
      await this.prismaService.tenancy.consultantAvailability.findFirst({
        where: {
          consultantId,
          type: AvailabilityType.CUSTOM,
          dateString,
          deletedAt: null,
        },
      });

    let intervals: Array<{ start: number; end: number }> = [];

    if (customAvail) {
      intervals = this.slotsToIntervals(customAvail.slots);
    } else {
      // Check weekly availability
      const dayOfWeek = getDay(slotDate);
      const dayLabels: DateLabel[] = [
        DateLabel.SUNDAY,
        DateLabel.MONDAY,
        DateLabel.TUESDAY,
        DateLabel.WEDNESDAY,
        DateLabel.THURSDAY,
        DateLabel.FRIDAY,
        DateLabel.SATURDAY,
      ];
      const dayLabel = dayLabels[dayOfWeek];

      const weeklyAvail =
        await this.prismaService.tenancy.consultantAvailability.findFirst({
          where: {
            consultantId,
            type: AvailabilityType.WEEKLY,
            dayOfWeek: dayLabel,
            deletedAt: null,
          },
        });

      if (weeklyAvail) {
        intervals = this.slotsToIntervals(weeklyAvail.slots);
      }
    }

    // Check if hour falls within any interval
    const isInInterval = intervals.some(
      (interval) => hour >= interval.start && hour < interval.end,
    );

    if (!isInInterval) {
      return false;
    }

    // Check if slot is already booked
    const existingSession = await this.prismaService.tenancy.session.findFirst({
      where: {
        consultantId,
        scheduledDateString: dateString,
        status: {
          notIn: ['CANCELED', 'DECLINED'],
        },
        deleted: false,
      },
    });

    return !existingSession;
  }

  /**
   * Delete custom availability record
   */
  async deleteCustomAvailability(consultantId: string, recordId: string) {
    const availability =
      await this.prismaService.tenancy.consultantAvailability.findFirst({
        where: {
          id: recordId,
          consultantId,
          type: AvailabilityType.CUSTOM,
        },
      });

    if (!availability) {
      throw new NotFoundException('Availability record not found');
    }

    // Soft delete
    await this.prismaService.tenancy.consultantAvailability.update({
      where: { id: recordId },
      data: { deletedAt: new Date() },
    });

    return { success: true };
  }

  /**
   * Helper: Convert intervals to slots (hour array)
   */
  private intervalsToSlots(
    intervals: Array<{ start: number; end: number }>,
  ): number[] {
    const slots = new Set<number>();

    for (const interval of intervals) {
      for (let hour = interval.start; hour < interval.end; hour++) {
        slots.add(hour);
      }
    }

    return Array.from(slots).sort((a, b) => a - b);
  }

  /**
   * Helper: Convert slots (hour array) to intervals
   */
  private slotsToIntervals(
    slots: number[],
  ): Array<{ start: number; end: number }> {
    if (slots.length === 0) return [];

    const sorted = [...slots].sort((a, b) => a - b);
    const intervals: Array<{ start: number; end: number }> = [];
    let start = sorted[0];
    let end = sorted[0] + 1;

    for (let i = 1; i < sorted.length; i++) {
      if (sorted[i] === end) {
        end++;
      } else {
        intervals.push({ start, end });
        start = sorted[i];
        end = sorted[i] + 1;
      }
    }

    intervals.push({ start, end });
    return intervals;
  }

  /**
   * Helper: Validate intervals
   */
  private validateIntervals(dto: UpdateAvailabilityDto) {
    const allIntervals: Array<{ start: number; end: number }> = [];

    // Collect all weekly intervals
    Object.values(dto.weekly).forEach((dayIntervals) => {
      if (dayIntervals) {
        allIntervals.push(...dayIntervals);
      }
    });

    // Collect all custom intervals
    if (dto.custom) {
      dto.custom.forEach((custom) => {
        allIntervals.push(...custom.intervals);
      });
    }

    // Validate each interval
    for (const interval of allIntervals) {
      if (interval.start < 0 || interval.start >= 24) {
        throw new BadRequestException(
          `Invalid start time: ${interval.start}. Must be between 0 and 23`,
        );
      }

      if (interval.end <= 0 || interval.end > 24) {
        throw new BadRequestException(
          `Invalid end time: ${interval.end}. Must be between 1 and 24`,
        );
      }

      if (interval.start >= interval.end) {
        throw new BadRequestException(
          `Start time (${interval.start}) must be less than end time (${interval.end})`,
        );
      }
    }

    // Check for overlaps on each day
    Object.entries(dto.weekly).forEach(([day, intervals]) => {
      if (intervals && intervals.length > 1) {
        this.checkOverlaps(intervals, day);
      }
    });

    if (dto.custom) {
      dto.custom.forEach((custom) => {
        if (custom.intervals.length > 1) {
          this.checkOverlaps(custom.intervals, custom.date);
        }
      });
    }
  }

  /**
   * Helper: Check for overlapping intervals
   */
  private checkOverlaps(
    intervals: Array<{ start: number; end: number }>,
    context: string,
  ) {
    const sorted = [...intervals].sort((a, b) => a.start - b.start);

    for (let i = 0; i < sorted.length - 1; i++) {
      if (sorted[i].end > sorted[i + 1].start) {
        throw new BadRequestException(
          `Overlapping intervals on ${context}: [${sorted[i].start}-${sorted[i].end}] and [${sorted[i + 1].start}-${sorted[i + 1].end}]`,
        );
      }
    }
  }

  /**
   * Helper: Calculate availability period (WEEKDAYS/WEEKENDS/MIXED)
   */
  private calculateAvailabilityPeriod(
    weekly: UpdateAvailabilityDto['weekly'],
  ): AvailabilityPeriod {
    const hasWeekdays =
      weekly.monday?.length ||
      weekly.tuesday?.length ||
      weekly.wednesday?.length ||
      weekly.thursday?.length ||
      weekly.friday?.length;

    const hasWeekends = weekly.saturday?.length || weekly.sunday?.length;

    if (hasWeekdays && hasWeekends) {
      return AvailabilityPeriod.MIXED;
    }

    if (hasWeekdays) {
      return AvailabilityPeriod.WEEKDAYS;
    }

    if (hasWeekends) {
      return AvailabilityPeriod.WEEKENDS;
    }

    return AvailabilityPeriod.MIXED; // Default
  }
}
