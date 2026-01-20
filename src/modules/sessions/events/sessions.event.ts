import { CreateSessionsDto } from '../dtos/create-sessions.dto';

export class SessionCreationEvent {
  constructor(
    public dto: CreateSessionsDto,
    public sessions: any[], // Session[]
    public sessionCount: number, // Total individual sessions before
    public coupleSessionCount: number, // Total couple sessions before
    public clientUserId: string,
  ) {}
}

export class SessionCancellationEvent {
  constructor(
    public sessionId: string,
    public clientId: string,
    public consultantId: string,
    public reason?: string,
  ) {}
}

export class SessionRescheduleEvent {
  constructor(
    public sessionId: string,
    public previousDate: Date,
    public newDate: Date,
    public clientId: string,
    public consultantId: string,
    public reason?: string,
  ) {}
}
