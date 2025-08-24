import { INestApplication } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Test, TestingModule } from "@nestjs/testing";
import * as request from "supertest";

import { AppModule } from "../src/app.module";

describe("AppController (e2e)", () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(ConfigService)
      .useValue({
        get: jest.fn((key: string) => {
          switch (key) {
            case "STRIPE_SECRET_KEY":
              return "sk_test_fake_key_for_testing";
            case "STRIPE_WEBHOOK_SECRET":
              return "whsec_test_webhook_secret";
            case "DB_SERVICE_URL":
              return "http://localhost:3001/api/v1";
            case "DB_SERVICE_API_KEY":
              return "test-api-key";
            case "AUTH_SERVICE_URL":
              return "http://localhost:3002/api/v1";
            case "AUTH_SERVICE_API_KEY":
              return "test-auth-key";
            case "PORT":
              return 3000;
            case "NODE_ENV":
              return "test";
            default:
              return null;
          }
        }),
      })
      .compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe("/ (GET)", () => {
    it("should return service information", () => {
      return request(app.getHttpServer())
        .get("/")
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty("service");
          expect(res.body).toHaveProperty("version");
          expect(res.body).toHaveProperty("status");
          expect(res.body).toHaveProperty("timestamp");
          expect(res.body.service).toBe("Penpal AI Payment Service");
        });
    });
  });

  describe("/health (GET)", () => {
    it("should return health status", () => {
      return request(app.getHttpServer())
        .get("/health")
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty("service");
          expect(res.body).toHaveProperty("status");
          expect(res.body).toHaveProperty("timestamp");
          expect(res.body).toHaveProperty("version");
          expect(res.body.status).toBe("OK");
        });
    });
  });

  describe("Error handling", () => {
    it("should return 404 for non-existent routes", () => {
      return request(app.getHttpServer())
        .get("/non-existent-route")
        .expect(404);
    });
  });
});
