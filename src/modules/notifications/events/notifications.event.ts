/** Emitted as soon as an order row exists, before payment is attempted. */
export class OrderCreatedEvent {
  constructor(
    public orderId: string,
    public totalAmount: number,
    public currency: string,
    public itemCount: number,
    public customerName: string,
    public isRecurring: boolean,
  ) {}
}

/** Emitted when an order's payment has been verified as successful. */
export class OrderPaidEvent {
  constructor(
    public orderId: string,
    public totalAmount: number,
    public currency: string,
    public customerName: string,
  ) {}
}
