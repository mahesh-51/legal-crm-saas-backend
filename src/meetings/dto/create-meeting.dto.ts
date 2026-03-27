import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { MeetingStatus } from '../../common/enums/meeting-status.enum';
import { MeetingLinkProvider } from '../../common/enums/meeting-link-provider.enum';

export class CreateMeetingDto {
  @IsOptional()
  @IsUUID()
  firmId?: string;

  @IsOptional()
  @IsUUID()
  matterId?: string;

  @IsOptional()
  @IsUUID()
  clientId?: string;

  @IsOptional()
  @IsUUID()
  dailyListingId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  title?: string | null;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  location?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1024)
  meetingUrl?: string;

  /** Google Meet, Microsoft Teams, Zoom, or other join link. */
  @IsOptional()
  @IsEnum(MeetingLinkProvider)
  meetingLinkProvider?: MeetingLinkProvider;

  /**
   * If true (default), clients see `meetingUrl` when listing/getting meetings.
   * If false, only firm users receive the join URL in API responses.
   */
  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => {
    if (value === undefined || value === null) return undefined;
    if (typeof value === 'boolean') return value;
    if (value === 'true' || value === true) return true;
    if (value === 'false' || value === false) return false;
    return value;
  })
  shareLinkWithClient?: boolean;

  @IsDateString()
  startAt: string;

  @IsOptional()
  @IsDateString()
  endAt?: string;

  @IsOptional()
  @IsEnum(MeetingStatus)
  status?: MeetingStatus;

  @IsOptional()
  @IsDateString()
  reminderAt?: string;

  @IsOptional()
  @IsUUID()
  organizerId?: string;
}
