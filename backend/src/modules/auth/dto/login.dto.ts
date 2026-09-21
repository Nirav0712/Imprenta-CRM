import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

export class LoginDto {
  @IsNotEmpty({ message: 'Email or Username is required' })
  @IsString()
  email: string;

  @IsNotEmpty({ message: 'Password is required' })
  @IsString()
  password: string;
}
