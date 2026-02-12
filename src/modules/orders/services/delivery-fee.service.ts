import { Injectable, Logger } from '@nestjs/common';

export interface DeliveryFeeConfig {
    deliveryFee: number; // Same-day delivery fee in minor currency units
}

@Injectable()
export class DeliveryFeeService {
    private readonly logger = new Logger(DeliveryFeeService.name);

    // Default delivery fee configuration
    // This can be moved to a database table for admin management
    private defaultConfig: DeliveryFeeConfig = {
        deliveryFee: 100000, // ₦1,000 - same-day delivery fee
    };

    constructor() { }

    /**
     * Get delivery fee configuration
     * In the future, this can fetch from a settings table
     */
    getConfig(): DeliveryFeeConfig {
        // TODO: Fetch from settings table when admin interface is ready
        // For now, return default config
        return this.defaultConfig;
    }

    /**
     * Calculate delivery fee (same-day delivery)
     */
    calculateDeliveryFee(
        _orderValue: number, // in minor currency units (not used currently, but kept for future use)
        city?: string, // not used currently, but kept for future use
        _state?: string, // not used currently, but kept for future use
    ): number {
        console.log('calculateDeliveryFee', _orderValue, city, _state);
        const config = this.getConfig();

        this.logger.log(
            `Delivery fee calculated - City: ${city}, Fee: ${config.deliveryFee}`,
        );

        return config.deliveryFee;
    }

    /**
     * Update delivery fee configuration (for admin)
     */
    updateConfig(config: Partial<DeliveryFeeConfig>): DeliveryFeeConfig {
        // TODO: Save to settings table when admin interface is ready
        this.defaultConfig = { ...this.defaultConfig, ...config };
        this.logger.log(
            `Delivery fee configuration updated: ${JSON.stringify(this.defaultConfig)}`,
        );
        return this.defaultConfig;
    }
}
