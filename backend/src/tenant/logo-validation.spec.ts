import { Test, TestingModule } from '@nestjs/testing';
import { TenantsController } from './tenants.controller';
import { TenantsService } from './tenants.service';
import { PrismaService } from '../prisma/prisma.service';
import * as fs from 'fs';
import * as path from 'path';

describe('Logo Validation (Magic Bytes & Format)', () => {
  let controller: TenantsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [TenantsController],
      providers: [
        {
          provide: TenantsService,
          useValue: {
            updateBranding: jest.fn().mockResolvedValue({ success: true }),
          },
        },
        {
          provide: PrismaService,
          useValue: {},
        },
      ],
    }).compile();

    controller = module.get<TenantsController>(TenantsController);
  });

  it('should accept a valid PNG image based on magic bytes', async () => {
    const tempFilePath = path.join(__dirname, 'test-temp-valid.png');
    // PNG Magic Bytes: 89 50 4E 47 0D 0A 1A 0A
    const pngHeader = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00]);
    fs.writeFileSync(tempFilePath, pngHeader);

    try {
      const isValid = await (controller as any).validateImageMagicBytes(tempFilePath);
      expect(isValid).toBe(true);
    } finally {
      if (fs.existsSync(tempFilePath)) {
        fs.unlinkSync(tempFilePath);
      }
    }
  });

  it('should accept a valid JPEG image based on magic bytes', async () => {
    const tempFilePath = path.join(__dirname, 'test-temp-valid.jpg');
    // JPEG Magic Bytes: FF D8 FF
    const jpegHeader = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46]);
    fs.writeFileSync(tempFilePath, jpegHeader);

    try {
      const isValid = await (controller as any).validateImageMagicBytes(tempFilePath);
      expect(isValid).toBe(true);
    } finally {
      if (fs.existsSync(tempFilePath)) {
        fs.unlinkSync(tempFilePath);
      }
    }
  });

  it('should reject a fake PNG image (e.g. text file or SVG disguised as PNG)', async () => {
    const tempFilePath = path.join(__dirname, 'test-temp-fake.png');
    // Content is plain XML/SVG
    const fakeHeader = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" />');
    fs.writeFileSync(tempFilePath, fakeHeader);

    try {
      const isValid = await (controller as any).validateImageMagicBytes(tempFilePath);
      expect(isValid).toBe(false);
    } finally {
      if (fs.existsSync(tempFilePath)) {
        fs.unlinkSync(tempFilePath);
      }
    }
  });
});
