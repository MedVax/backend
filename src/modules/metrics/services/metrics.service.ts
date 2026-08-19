import { Injectable, Logger } from '@nestjs/common';
import { PrismaTenancyService } from 'modules/prisma-tenancy/prisma-tenancy.service';
import {
  startOfMonth,
  endOfMonth,
  startOfDay,
  endOfDay,
  subDays,
  format,
  eachDayOfInterval,
  parseISO,
  startOfWeek,
  endOfWeek,
  subYears,
} from 'date-fns';
import {
  OrderStatus,
  PaymentStatus,
  UserStatus,
  UserType,
} from 'generated/prisma/enums';
import type { Prisma } from 'generated/prisma/client';
import { GetReviewMetricsDto } from '../dtos/get-review-metrics.dto';
import {
  GetDashboardMetricsDto,
  DateRangePreset,
} from '../dtos/get-dashboard-metrics.dto';
import { GetUserMetricsDto } from '../dtos/get-user-metrics.dto';

@Injectable()
export class MetricsService {
  private logger = new Logger(MetricsService.name);

  constructor(private prismaService: PrismaTenancyService) {}

  async getAdminDashboardMetrics(dto?: GetDashboardMetricsDto) {
    const now = new Date();
    const todayStart = startOfDay(now);
    const todayEnd = endOfDay(now);
    const weekStart = startOfWeek(now, { weekStartsOn: 1 });
    const weekEnd = endOfWeek(now, { weekStartsOn: 1 });
    const monthStart = startOfMonth(now);
    const monthEnd = endOfMonth(now);

    // Determine date range for charts
    let chartStartDate: Date;
    let chartEndDate: Date = now;

    if (
      dto?.dateRange === DateRangePreset.CUSTOM &&
      dto.startDate &&
      dto.endDate
    ) {
      chartStartDate = parseISO(dto.startDate);
      chartEndDate = parseISO(dto.endDate);
    } else if (dto?.dateRange === DateRangePreset.TODAY) {
      chartStartDate = todayStart;
      chartEndDate = todayEnd;
    } else if (dto?.dateRange === DateRangePreset.LAST_7_DAYS) {
      chartStartDate = subDays(now, 7);
    } else if (dto?.dateRange === DateRangePreset.LAST_90_DAYS) {
      chartStartDate = subDays(now, 90);
    } else if (dto?.dateRange === DateRangePreset.LAST_YEAR) {
      chartStartDate = subYears(now, 1);
    } else {
      // Default to last 30 days
      chartStartDate = subDays(now, 30);
    }

    chartStartDate = startOfDay(chartStartDate);
    chartEndDate = endOfDay(chartEndDate);

    // Get all metrics in parallel
    const [
      totalOrders,
      ordersToday,
      ordersThisWeek,
      ordersThisMonth,
      totalRevenue,
      revenueToday,
      revenueThisWeek,
      revenueThisMonth,
      totalUsers,
      usersThisMonth,
      statusDistribution,
      revenueChartData,
      ordersChartData,
      averageOrderValue,
      topProducts,
      salesByCategory,
      pendingOrdersCount,
      lowStockProducts,
      customerGrowthData,
    ] = await Promise.all([
      // Orders
      this.prismaService.tenancy.order.count(),
      this.prismaService.tenancy.order.count({
        where: { createdAt: { gte: todayStart, lte: todayEnd } },
      }),
      this.prismaService.tenancy.order.count({
        where: { createdAt: { gte: weekStart, lte: weekEnd } },
      }),
      this.prismaService.tenancy.order.count({
        where: { createdAt: { gte: monthStart, lte: monthEnd } },
      }),

      // Revenue
      this.prismaService.tenancy.order.aggregate({
        where: { paymentStatus: PaymentStatus.PAID },
        _sum: { totalAmount: true },
      }),
      this.prismaService.tenancy.order.aggregate({
        where: {
          paymentStatus: PaymentStatus.PAID,
          createdAt: { gte: todayStart, lte: todayEnd },
        },
        _sum: { totalAmount: true },
      }),
      this.prismaService.tenancy.order.aggregate({
        where: {
          paymentStatus: PaymentStatus.PAID,
          createdAt: { gte: weekStart, lte: weekEnd },
        },
        _sum: { totalAmount: true },
      }),
      this.prismaService.tenancy.order.aggregate({
        where: {
          paymentStatus: PaymentStatus.PAID,
          createdAt: { gte: monthStart, lte: monthEnd },
        },
        _sum: { totalAmount: true },
      }),

      // Customers. Admins and super admins are staff, not customers, so
      // counting every user would inflate this card.
      this.prismaService.tenancy.user.count({
        where: { type: UserType.USER },
      }),
      this.prismaService.tenancy.user.count({
        where: {
          type: UserType.USER,
          createdAt: { gte: monthStart, lte: monthEnd },
        },
      }),

      // Status distribution
      this.getStatusDistribution(),

      // Chart data
      this.getRevenueChartData(chartStartDate, chartEndDate),
      this.getOrdersChartData(chartStartDate, chartEndDate),

      // Average order value
      this.getAverageOrderValue(),

      // Top products
      this.getTopProducts(10),

      // Sales by category
      this.getSalesByCategory(chartStartDate, chartEndDate),

      // Pending orders count
      this.prismaService.tenancy.order.count({
        where: {
          orderStatus: {
            in: [
              OrderStatus.PENDING,
              OrderStatus.ACCEPTED,
              OrderStatus.PROCESSING,
            ],
          },
        },
      }),

      // Low stock products
      this.getLowStockProducts(10),

      // Customer growth
      this.getCustomerGrowthData(chartStartDate, chartEndDate),
    ]);

    return {
      // Key Metrics
      revenue: {
        total: totalRevenue._sum.totalAmount || 0,
        today: revenueToday._sum.totalAmount || 0,
        thisWeek: revenueThisWeek._sum.totalAmount || 0,
        thisMonth: revenueThisMonth._sum.totalAmount || 0,
      },
      orders: {
        total: totalOrders,
        today: ordersToday,
        thisWeek: ordersThisWeek,
        thisMonth: ordersThisMonth,
      },
      customers: {
        total: totalUsers,
        thisMonth: usersThisMonth,
      },
      averageOrderValue: averageOrderValue,
      pendingOrders: pendingOrdersCount,

      // Charts
      revenueChartData,
      ordersChartData,
      customerGrowthData,

      // Analytics
      statusDistribution,
      topProducts,
      salesByCategory,
      lowStockProducts,
    };
  }

  async getProductMetrics() {
    const now = new Date();
    const startOfCurrentMonth = startOfMonth(now);
    const endOfCurrentMonth = endOfMonth(now);

    const [
      totalProducts,
      activeProducts,
      inactiveProducts,
      newProductsThisMonth,
    ] = await Promise.all([
      // Total products
      this.prismaService.tenancy.product.count(),

      // Active products
      this.prismaService.tenancy.product.count({
        where: {
          isActive: true,
        },
      }),

      // Inactive products
      this.prismaService.tenancy.product.count({
        where: {
          isActive: false,
        },
      }),

      // New products this month
      this.prismaService.tenancy.product.count({
        where: {
          createdAt: {
            gte: startOfCurrentMonth,
            lte: endOfCurrentMonth,
          },
        },
      }),
    ]);

    return {
      totalProducts,
      activeProducts,
      inactiveProducts,
      newProductsThisMonth,
    };
  }

  /**
   * Totals for the Orders list page. The page can only ever hold one page of
   * orders in memory, so every one of these has to be counted by the database.
   */
  async getOrderMetrics() {
    const now = new Date();
    const monthStart = startOfMonth(now);
    const monthEnd = endOfMonth(now);

    const [
      totalOrders,
      pendingOrders,
      paidOrders,
      revenue,
      revenueThisMonth,
      ordersThisMonth,
    ] = await Promise.all([
      this.prismaService.tenancy.order.count(),

      this.prismaService.tenancy.order.count({
        where: { orderStatus: OrderStatus.PENDING },
      }),

      this.prismaService.tenancy.order.count({
        where: { paymentStatus: PaymentStatus.PAID },
      }),

      this.prismaService.tenancy.order.aggregate({
        where: { paymentStatus: PaymentStatus.PAID },
        _sum: { totalAmount: true },
      }),

      this.prismaService.tenancy.order.aggregate({
        where: {
          paymentStatus: PaymentStatus.PAID,
          createdAt: { gte: monthStart, lte: monthEnd },
        },
        _sum: { totalAmount: true },
      }),

      this.prismaService.tenancy.order.count({
        where: { createdAt: { gte: monthStart, lte: monthEnd } },
      }),
    ]);

    return {
      totalOrders,
      pendingOrders,
      paidOrders,
      ordersThisMonth,
      totalRevenue: revenue._sum.totalAmount || 0,
      revenueThisMonth: revenueThisMonth._sum.totalAmount || 0,
    };
  }

  /**
   * Totals for the user list pages. `type` mirrors the filter the calling page
   * lists by, so the cards and the table below them always agree.
   */
  async getUserMetrics(dto?: GetUserMetricsDto) {
    const now = new Date();
    const monthStart = startOfMonth(now);
    const monthEnd = endOfMonth(now);

    const where: Prisma.UserWhereInput = dto?.type?.length
      ? { type: { in: dto.type } }
      : {};

    const [totalUsers, activeUsers, inactiveUsers, newUsersThisMonth] =
      await Promise.all([
        this.prismaService.tenancy.user.count({ where }),

        this.prismaService.tenancy.user.count({
          where: { ...where, status: UserStatus.ACTIVE },
        }),

        // Deactivated accounts read as inactive to an admin - the distinction
        // only matters to the account holder.
        this.prismaService.tenancy.user.count({
          where: {
            ...where,
            status: { in: [UserStatus.INACTIVE, UserStatus.DEACTIVATED] },
          },
        }),

        this.prismaService.tenancy.user.count({
          where: { ...where, createdAt: { gte: monthStart, lte: monthEnd } },
        }),
      ]);

    return { totalUsers, activeUsers, inactiveUsers, newUsersThisMonth };
  }

  /**
   * Totals for the Clients list page. Soft-deleted clients are excluded to
   * match what `ClientsService.findAll` lists.
   */
  async getClientMetrics() {
    const now = new Date();
    const monthStart = startOfMonth(now);
    const monthEnd = endOfMonth(now);

    const where: Prisma.UserProfileClientWhereInput = { deletedAt: null };

    const [totalClients, activeClients, inactiveClients, newClientsThisMonth] =
      await Promise.all([
        this.prismaService.tenancy.userProfileClient.count({ where }),

        // A client profile has no status of its own; the account behind it does.
        this.prismaService.tenancy.userProfileClient.count({
          where: {
            ...where,
            userProfile: { user: { status: UserStatus.ACTIVE } },
          },
        }),

        this.prismaService.tenancy.userProfileClient.count({
          where: {
            ...where,
            userProfile: {
              user: {
                status: { in: [UserStatus.INACTIVE, UserStatus.DEACTIVATED] },
              },
            },
          },
        }),

        this.prismaService.tenancy.userProfileClient.count({
          where: { ...where, createdAt: { gte: monthStart, lte: monthEnd } },
        }),
      ]);

    return {
      totalClients,
      activeClients,
      inactiveClients,
      newClientsThisMonth,
    };
  }

  /**
   * Totals for the Consultants list page. Soft-deleted consultants are excluded
   * to match what `ConsultantsService.findAll` lists.
   */
  async getConsultantMetrics() {
    const now = new Date();
    const monthStart = startOfMonth(now);
    const monthEnd = endOfMonth(now);

    const where: Prisma.UserProfileConsultantWhereInput = { deletedAt: null };

    const [
      totalConsultants,
      activeConsultants,
      inactiveConsultants,
      newConsultantsThisMonth,
    ] = await Promise.all([
      this.prismaService.tenancy.userProfileConsultant.count({ where }),

      this.prismaService.tenancy.userProfileConsultant.count({
        where: {
          ...where,
          userProfile: { user: { status: UserStatus.ACTIVE } },
        },
      }),

      this.prismaService.tenancy.userProfileConsultant.count({
        where: {
          ...where,
          userProfile: {
            user: {
              status: { in: [UserStatus.INACTIVE, UserStatus.DEACTIVATED] },
            },
          },
        },
      }),

      this.prismaService.tenancy.userProfileConsultant.count({
        where: { ...where, createdAt: { gte: monthStart, lte: monthEnd } },
      }),
    ]);

    return {
      totalConsultants,
      activeConsultants,
      inactiveConsultants,
      newConsultantsThisMonth,
    };
  }

  private async getStatusDistribution() {
    const [
      pending,
      accepted,
      processing,
      readyForDispatch,
      inTransit,
      delivered,
      completed,
      cancelled,
      failedPayment,
    ] = await Promise.all([
      this.prismaService.tenancy.order.count({
        where: { orderStatus: OrderStatus.PENDING },
      }),
      this.prismaService.tenancy.order.count({
        where: { orderStatus: OrderStatus.ACCEPTED },
      }),
      this.prismaService.tenancy.order.count({
        where: { orderStatus: OrderStatus.PROCESSING },
      }),
      this.prismaService.tenancy.order.count({
        where: { orderStatus: OrderStatus.READY_FOR_DISPATCH },
      }),
      this.prismaService.tenancy.order.count({
        where: { orderStatus: OrderStatus.IN_TRANSIT },
      }),
      this.prismaService.tenancy.order.count({
        where: { orderStatus: OrderStatus.DELIVERED },
      }),
      this.prismaService.tenancy.order.count({
        where: { orderStatus: OrderStatus.COMPLETED },
      }),
      this.prismaService.tenancy.order.count({
        where: { orderStatus: OrderStatus.CANCELED },
      }),
      this.prismaService.tenancy.order.count({
        where: { orderStatus: OrderStatus.FAILED_PAYMENT },
      }),
    ]);

    return {
      pending,
      accepted,
      processing,
      readyForDispatch,
      inTransit,
      delivered,
      completed,
      cancelled,
      failedPayment,
    };
  }

  private async getRevenueChartData(startDate: Date, endDate: Date) {
    // Use raw SQL to aggregate revenue by date in a single query
    // This is much more efficient than querying each day individually
    const revenueData = await this.prismaService.tenancy.$queryRaw<
      Array<{
        date: Date;
        revenue: bigint | null;
      }>
    >`
      SELECT 
        DATE(o."createdAt")::text as date,
        SUM(o."totalAmount") as revenue
      FROM "Order" o
      WHERE o."paymentStatus" = 'PAID'
        AND o."createdAt" >= ${startDate}
        AND o."createdAt" <= ${endDate}
      GROUP BY DATE(o."createdAt")
      ORDER BY date ASC
    `;

    // Create a map for quick lookup
    const revenueMap = new Map(
      revenueData.map((row) => [
        format(new Date(row.date), 'yyyy-MM-dd'),
        Number(row.revenue || 0),
      ]),
    );

    // Fill in all days in the range, using 0 for days with no revenue
    const days = eachDayOfInterval({ start: startDate, end: endDate });
    return days.map((day) => {
      const dateKey = format(day, 'yyyy-MM-dd');
      return {
        date: dateKey,
        revenue: revenueMap.get(dateKey) || 0,
      };
    });
  }

  private async getOrdersChartData(startDate: Date, endDate: Date) {
    // Use raw SQL to count orders by date in a single query
    const ordersData = await this.prismaService.tenancy.$queryRaw<
      Array<{
        date: Date;
        orders: bigint;
      }>
    >`
      SELECT 
        DATE(o."createdAt")::text as date,
        COUNT(*)::bigint as orders
      FROM "Order" o
      WHERE o."createdAt" >= ${startDate}
        AND o."createdAt" <= ${endDate}
      GROUP BY DATE(o."createdAt")
      ORDER BY date ASC
    `;

    // Create a map for quick lookup
    const ordersMap = new Map(
      ordersData.map((row) => [
        format(new Date(row.date), 'yyyy-MM-dd'),
        Number(row.orders),
      ]),
    );

    // Fill in all days in the range, using 0 for days with no orders
    const days = eachDayOfInterval({ start: startDate, end: endDate });
    return days.map((day) => {
      const dateKey = format(day, 'yyyy-MM-dd');
      return {
        date: dateKey,
        orders: ordersMap.get(dateKey) || 0,
      };
    });
  }

  private async getAverageOrderValue(): Promise<number> {
    const result = await this.prismaService.tenancy.order.aggregate({
      where: {
        paymentStatus: PaymentStatus.PAID,
      },
      _avg: {
        totalAmount: true,
      },
    });

    return result._avg.totalAmount || 0;
  }

  private async getTopProducts(limit: number = 10) {
    const topProducts = await this.prismaService.tenancy.orderItem.groupBy({
      by: ['productId'],
      _sum: {
        quantity: true,
        unitPrice: true,
      },
      _count: {
        id: true,
      },
      orderBy: {
        _sum: {
          quantity: 'desc',
        },
      },
      take: limit,
    });

    const productIds = topProducts.map((item) => item.productId);
    const products = await this.prismaService.tenancy.product.findMany({
      where: {
        id: { in: productIds },
      },
      select: {
        id: true,
        name: true,
        sku: true,
        images: true,
        category: {
          select: {
            name: true,
          },
        },
      },
    });

    const productMap = new Map(products.map((p) => [p.id, p]));

    return topProducts.map((item) => {
      const product = productMap.get(item.productId);
      return {
        productId: item.productId,
        name: product?.name || 'Unknown',
        sku: product?.sku || '',
        category: product?.category?.name || 'Uncategorized',
        image: product?.images?.[0] || null,
        totalQuantity: item._sum.quantity || 0,
        totalRevenue: (item._sum.unitPrice || 0) * (item._sum.quantity || 0),
        orderCount: item._count.id || 0,
      };
    });
  }

  private async getSalesByCategory(startDate: Date, endDate: Date) {
    // Use raw SQL aggregation to avoid loading all orders into memory
    // This aggregates revenue and order counts by category directly in the database
    const salesByCategory = await this.prismaService.tenancy.$queryRaw<
      Array<{
        categoryId: string | null;
        categoryName: string | null;
        revenue: bigint;
        orderCount: bigint;
      }>
    >`
      SELECT 
        p."categoryId",
        c.name as "categoryName",
        SUM(oi."unitPrice" * oi.quantity) as revenue,
        COUNT(DISTINCT oi."orderId") as "orderCount"
      FROM "OrderItem" oi
      INNER JOIN "Order" o ON oi."orderId" = o.id
      INNER JOIN "Product" p ON oi."productId" = p.id
      LEFT JOIN "Category" c ON p."categoryId" = c.id
      WHERE o."paymentStatus" = 'PAID'
        AND o."createdAt" >= ${startDate}
        AND o."createdAt" <= ${endDate}
      GROUP BY p."categoryId", c.name
      ORDER BY revenue DESC
    `;

    // Transform the results and handle uncategorized items
    const categoryMap = new Map<
      string,
      { name: string; revenue: number; orders: number }
    >();

    for (const row of salesByCategory) {
      const categoryId = row.categoryId || 'uncategorized';
      const categoryName = row.categoryName || 'Uncategorized';
      const revenue = Number(row.revenue);
      const orders = Number(row.orderCount);

      categoryMap.set(categoryId, {
        name: categoryName,
        revenue,
        orders,
      });
    }

    return Array.from(categoryMap.values()).sort(
      (a, b) => b.revenue - a.revenue,
    );
  }

  private async getLowStockProducts(limit: number = 10) {
    const lowStockThreshold = 20; // Products with stock <= 20

    const products = await this.prismaService.tenancy.product.findMany({
      where: {
        isActive: true,
        stockQuantity: {
          lte: lowStockThreshold,
        },
      },
      select: {
        id: true,
        name: true,
        sku: true,
        stockQuantity: true,
        images: true,
        category: {
          select: {
            name: true,
          },
        },
      },
      orderBy: {
        stockQuantity: 'asc',
      },
      take: limit,
    });

    return products.map((product) => ({
      productId: product.id,
      name: product.name,
      sku: product.sku,
      category: product.category?.name || 'Uncategorized',
      stockQuantity: product.stockQuantity,
      image: product.images?.[0] || null,
    }));
  }

  private async getCustomerGrowthData(startDate: Date, endDate: Date) {
    // Use raw SQL to count new customers by date in a single query.
    // Staff accounts are excluded to match the customers card above.
    const customersData = await this.prismaService.tenancy.$queryRaw<
      Array<{
        date: Date;
        customers: bigint;
      }>
    >`
      SELECT 
        DATE(u."createdAt")::text as date,
        COUNT(*)::bigint as customers
      FROM "User" u
      WHERE u."type" = 'USER'
        AND u."createdAt" >= ${startDate}
        AND u."createdAt" <= ${endDate}
      GROUP BY DATE(u."createdAt")
      ORDER BY date ASC
    `;

    // Create a map for quick lookup
    const customersMap = new Map(
      customersData.map((row) => [
        format(new Date(row.date), 'yyyy-MM-dd'),
        Number(row.customers),
      ]),
    );

    // Fill in all days in the range, using 0 for days with no new customers
    const days = eachDayOfInterval({ start: startDate, end: endDate });
    return days.map((day) => {
      const dateKey = format(day, 'yyyy-MM-dd');
      return {
        date: dateKey,
        customers: customersMap.get(dateKey) || 0,
      };
    });
  }

  async getReviewMetrics(dto: GetReviewMetricsDto) {
    const now = new Date();
    let startDate: Date;
    let endDate: Date;

    if (dto.startDate && dto.endDate) {
      startDate = parseISO(dto.startDate);
      endDate = parseISO(dto.endDate);
    } else {
      // Default to last 30 days if no dates provided
      endDate = now;
      startDate = subDays(now, 30);
    }

    // Ensure dates are at start and end of day
    const startOfPeriod = new Date(startDate);
    startOfPeriod.setHours(0, 0, 0, 0);
    const endOfPeriod = new Date(endDate);
    endOfPeriod.setHours(23, 59, 59, 999);

    // Get all reviews in the date range
    const reviews = await this.prismaService.tenancy.sessionReview.findMany({
      where: {
        createdAt: {
          gte: startOfPeriod,
          lte: endOfPeriod,
        },
      },
      include: {
        session: {
          include: {
            consultant: {
              select: {
                id: true,
              },
            },
          },
        },
      },
      orderBy: {
        createdAt: 'asc',
      },
    });

    // Calculate overall statistics
    const totalReviews = reviews.length;
    const averageRating =
      totalReviews > 0
        ? reviews.reduce((sum, review) => sum + review.rating, 0) / totalReviews
        : 0;

    // Rating distribution
    const ratingDistribution = {
      5: reviews.filter((r) => r.rating === 5).length,
      4: reviews.filter((r) => r.rating === 4).length,
      3: reviews.filter((r) => r.rating === 3).length,
      2: reviews.filter((r) => r.rating === 2).length,
      1: reviews.filter((r) => r.rating === 1).length,
    };

    // Generate daily chart data
    const days = eachDayOfInterval({ start: startOfPeriod, end: endOfPeriod });
    const chartData = [];

    for (const day of days) {
      const startOfDay = new Date(day);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(day);
      endOfDay.setHours(23, 59, 59, 999);

      const dayReviews = reviews.filter(
        (review) =>
          review.createdAt >= startOfDay && review.createdAt <= endOfDay,
      );

      const dayAverageRating =
        dayReviews.length > 0
          ? dayReviews.reduce((sum, review) => sum + review.rating, 0) /
            dayReviews.length
          : 0;

      chartData.push({
        date: format(day, 'yyyy-MM-dd'),
        reviews: dayReviews.length,
        averageRating: Math.round(dayAverageRating * 10) / 10, // Round to 1 decimal
        ratings: {
          5: dayReviews.filter((r) => r.rating === 5).length,
          4: dayReviews.filter((r) => r.rating === 4).length,
          3: dayReviews.filter((r) => r.rating === 3).length,
          2: dayReviews.filter((r) => r.rating === 2).length,
          1: dayReviews.filter((r) => r.rating === 1).length,
        },
      });
    }

    return {
      totalReviews,
      averageRating: Math.round(averageRating * 10) / 10,
      ratingDistribution,
      chartData,
      period: {
        startDate: format(startOfPeriod, 'yyyy-MM-dd'),
        endDate: format(endOfPeriod, 'yyyy-MM-dd'),
      },
    };
  }
}
