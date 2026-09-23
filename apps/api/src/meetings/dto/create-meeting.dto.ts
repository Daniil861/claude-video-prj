import {
  IsArray,
  IsEmail,
  IsISO8601,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateMeetingDto {
  @IsString()
  @IsNotEmpty({ message: 'Укажите название встречи' })
  @MaxLength(200, { message: 'Название должно быть не длиннее 200 символов' })
  title!: string;

  /** Scheduled start; stored as `startsAt`. */
  @IsISO8601({ strict: true }, { message: 'Дата должна быть в формате ISO 8601' })
  date!: string;

  @IsArray({ message: 'Участники должны быть списком email' })
  @IsEmail({}, { each: true, message: 'Некорректный email участника' })
  participants!: string[];

  @IsOptional()
  @IsInt()
  @Min(1, { message: 'Длительность должна быть не меньше минуты' })
  durationMinutes?: number;
}
