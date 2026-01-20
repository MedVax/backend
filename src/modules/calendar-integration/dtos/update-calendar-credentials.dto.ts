export interface UpdateCalendarCredentialsDto {
  accessToken?: string;
  refreshToken?: string;
  tokenExpiry?: Date;
  isConnected?: boolean;
  metadata?: any;
}
