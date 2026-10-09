export const swaggerDocument = {
  openapi: '3.0.0',
  info: {
    title: 'JADS Backend Server API',
    version: '1.0.0',
    description:
      'API Documentation สำหรับระบบ JADS รองรับ PostgreSQL, Prisma, ระบบ Audit Log, ระบบ เข้าสู่ระบบ (JWT) และระบบ Recent Files (เข้ารหัส Local File Path ด้วย AES-256-GCM)',
  },
  servers: [
    {
      url: 'http://localhost:3000',
      description: 'Local Development Server',
    },
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'กรอก JWT Token ที่ได้จาก /api/auth/login',
      },
    },
    schemas: {
      ErrorResponse: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: false },
          message: { type: 'string', example: 'Error message description' },
        },
      },
      User: {
        type: 'object',
        properties: {
          id: { type: 'string', example: 'd3b07384-d113-4a11-b007-8278f3f87c67' },
          username: { type: 'string', example: 'admin' },
          fullName: { type: 'string', example: 'Admin User' },
          role: { type: 'string', enum: ['USER', 'ADMIN'], example: 'USER' },
          createdAt: { type: 'string', format: 'date-time' },
        },
      },
      RegisterRequest: {
        type: 'object',
        required: ['username', 'password'],
        properties: {
          username: { type: 'string', example: 'user1', description: 'ความยาว 3-50 ตัวอักษร (a-z, 0-9, _, -, .)' },
          password: { type: 'string', example: 'Password123', description: 'ความยาวอย่างน้อย 8 ตัวอักษร' },
          fullName: { type: 'string', example: 'สมชาย รักชาติ', description: 'ชื่อ-นามสกุล (ไม่บังคับ)' },
        },
      },
      LoginRequest: {
        type: 'object',
        required: ['username', 'password'],
        properties: {
          username: { type: 'string', example: 'user1' },
          password: { type: 'string', example: 'Password123' },
        },
      },
      AuthResponse: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: true },
          message: { type: 'string', example: 'Login successful' },
          data: {
            type: 'object',
            properties: {
              user: { $ref: '#/components/schemas/User' },
              token: { type: 'string', example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' },
            },
          },
        },
      },
      RecentFile: {
        type: 'object',
        properties: {
          id: { type: 'string', example: 'c4e09f58-953a-4e2b-bb47-759f212fb947' },
          fileName: { type: 'string', example: 'รายงานคดี2356.docx' },
          localPath: {
            type: 'string',
            description: 'ตำแหน่งไฟล์ในเครื่องผู้ใช้ (ถูกถอดรหัสคืนให้เฉพาะผู้ใช้ที่เป็นเจ้าของ)',
            example: 'C:\\Users\\PHONGPHAT\\Documents\\รายงานคดี2356.docx',
          },
          fileType: { type: 'string', example: 'docx' },
          lastOpenedAt: { type: 'string', format: 'date-time' },
          createdAt: { type: 'string', format: 'date-time' },
        },
      },
      AddRecentFileRequest: {
        type: 'object',
        required: ['fileName', 'localPath'],
        properties: {
          fileName: { type: 'string', example: 'รายงานคดี2356.docx' },
          localPath: {
            type: 'string',
            description: 'ตำแหน่งไฟล์ในเครื่องผู้ใช้ (จะถูกเข้ารหัสด้วย AES-256-GCM ก่อนบันทึกลง PostgreSQL)',
            example: 'C:\\Users\\PHONGPHAT\\Documents\\รายงานคดี2356.docx',
          },
          fileType: { type: 'string', example: 'docx' },
        },
      },
      AuditLog: {
        type: 'object',
        properties: {
          id: { type: 'string', example: 'a5c76059-42b7-4c07-b08a-212d1b54a24f' },
          userId: { type: 'string', nullable: true },
          action: { type: 'string', example: 'USER_LOGIN' },
          resource: { type: 'string', example: 'auth' },
          details: { type: 'object' },
          ipAddress: { type: 'string', example: '127.0.0.1' },
          userAgent: { type: 'string' },
          status: { type: 'string', example: 'SUCCESS' },
          createdAt: { type: 'string', format: 'date-time' },
          user: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              username: { type: 'string' },
              fullName: { type: 'string' },
              role: { type: 'string' },
            },
          },
        },
      },
    },
  },
  paths: {
    '/api/auth/register': {
      post: {
        tags: ['Authentication'],
        summary: 'ลงทะเบียนผู้ใช้ใหม่ (Register)',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/RegisterRequest' },
            },
          },
        },
        responses: {
          201: {
            description: 'ลงทะเบียนสำเร็จ',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/AuthResponse' },
              },
            },
          },
          400: {
            description: 'ข้อมูลไม่ถูกต้อง หรือชื่อผู้ใช้ซ้ำ',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
        },
      },
    },
    '/api/auth/login': {
      post: {
        tags: ['Authentication'],
        summary: 'เข้าสู่ระบบ (Login) เพื่อรับ JWT Token',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/LoginRequest' },
            },
          },
        },
        responses: {
          200: {
            description: 'เข้าสู่ระบบสำเร็จ',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/AuthResponse' },
              },
            },
          },
          401: {
            description: 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
        },
      },
    },
    '/api/auth/me': {
      get: {
        tags: ['Authentication'],
        summary: 'ดูข้อมูลโปรไฟล์ผู้ใช้ปัจจุบัน',
        security: [{ bearerAuth: [] }],
        responses: {
          200: {
            description: 'ข้อมูลผู้ใช้',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    data: { $ref: '#/components/schemas/User' },
                  },
                },
              },
            },
          },
          401: {
            description: 'Unauthorized',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
        },
      },
    },
    '/api/auth/profile': {
      put: {
        tags: ['Authentication'],
        summary: 'แก้ไขข้อมูลส่วนตัว (เช่น ชื่อ-นามสกุล)',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['fullName'],
                properties: {
                  fullName: { type: 'string', example: 'สมชาย รักยุติธรรม' },
                },
              },
            },
          },
        },
        responses: {
          200: {
            description: 'แก้ไขสำเร็จ',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    message: { type: 'string', example: 'อัปเดตข้อมูลส่วนตัวสำเร็จ' },
                    data: { $ref: '#/components/schemas/User' },
                  },
                },
              },
            },
          },
          400: { description: 'ข้อมูลไม่ถูกต้อง' },
          401: { description: 'Unauthorized' },
        },
      },
    },
    '/api/auth/change-password': {
      put: {
        tags: ['Authentication'],
        summary: 'เปลี่ยนรหัสผ่านผู้ใช้',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['currentPassword', 'newPassword'],
                properties: {
                  currentPassword: { type: 'string', example: 'OldPassword123!' },
                  newPassword: { type: 'string', example: 'NewPassword123!' },
                },
              },
            },
          },
        },
        responses: {
          200: {
            description: 'เปลี่ยนรหัสผ่านสำเร็จ',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    message: { type: 'string', example: 'เปลี่ยนรหัสผ่านสำเร็จ' },
                  },
                },
              },
            },
          },
          400: { description: 'รหัสผ่านเดิมไม่ถูกต้อง หรือรหัสผ่านใหม่สั้นเกินไป' },
          401: { description: 'Unauthorized' },
        },
      },
    },
    '/api/auth/logout': {
      post: {
        tags: ['Authentication'],
        summary: 'ออกจากระบบ (บันทึก Audit Log USER_LOGOUT)',
        security: [{ bearerAuth: [] }],
        responses: {
          200: {
            description: 'ออกจากระบบสำเร็จ',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    message: { type: 'string', example: 'Logged out successfully' },
                  },
                },
              },
            },
          },
        },
      },
    },
    '/api/recent-files': {
      get: {
        tags: ['Recent Files'],
        summary: 'ดึงรายการไฟล์ล่าสุดของผู้ใช้ (ถอดรหัส Local File Path ส่งคืน)',
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: 'limit',
            in: 'query',
            description: 'จำนวนรายการสูงสุด',
            schema: { type: 'integer', default: 50 },
          },
        ],
        responses: {
          200: {
            description: 'รายการไฟล์ล่าสุด',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    data: {
                      type: 'array',
                      items: { $ref: '#/components/schemas/RecentFile' },
                    },
                  },
                },
              },
            },
          },
          401: { description: 'Unauthorized' },
        },
      },
      post: {
        tags: ['Recent Files'],
        summary: 'บันทึกประวัติไฟล์ล่าสุด (เข้ารหัส Local File Path ก่อนบันทึกใน PostgreSQL)',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/AddRecentFileRequest' },
            },
          },
        },
        responses: {
          201: {
            description: 'บันทึกข้อมูลเรียบร้อย',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    message: { type: 'string', example: 'Recent file registered securely' },
                    data: { $ref: '#/components/schemas/RecentFile' },
                  },
                },
              },
            },
          },
          401: { description: 'Unauthorized' },
        },
      },
    },
    '/api/recent-files/{id}': {
      delete: {
        tags: ['Recent Files'],
        summary: 'ลบรายการประวัติไฟล์ล่าสุด',
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            description: 'ID ของ Recent File',
            schema: { type: 'string' },
          },
        ],
        responses: {
          200: {
            description: 'ลบสำเร็จ',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    message: { type: 'string', example: 'Recent file removed successfully' },
                  },
                },
              },
            },
          },
          401: { description: 'Unauthorized' },
          404: { description: 'ไม่พบรายการ' },
        },
      },
    },
    '/api/audit-logs': {
      get: {
        tags: ['Audit Logs'],
        summary: 'สืบค้นประวัติการใช้งาน (Audit Logs)',
        description: 'ผู้ใช้ทั่วไปดูได้เฉพาะของตนเอง สำหรับ Admin สามารถดูของทั้งระบบได้',
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 20 } },
          { name: 'action', in: 'query', schema: { type: 'string' } },
          { name: 'status', in: 'query', schema: { type: 'string', enum: ['SUCCESS', 'FAILED'] } },
        ],
        responses: {
          200: {
            description: 'รายการ Audit Logs พร้อม pagination',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    data: {
                      type: 'object',
                      properties: {
                        page: { type: 'integer' },
                        limit: { type: 'integer' },
                        total: { type: 'integer' },
                        totalPages: { type: 'integer' },
                        logs: {
                          type: 'array',
                          items: { $ref: '#/components/schemas/AuditLog' },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
          401: { description: 'Unauthorized' },
        },
      },
    },
    '/api/templates': {
      get: {
        tags: ['Templates & Documents'],
        summary: 'ดึงรายชื่อ Template ไฟล์ Docx ทั้งหมดที่มีในระบบ (ต้องเข้าสู่ระบบ)',
        security: [{ bearerAuth: [] }],
        responses: {
          200: {
            description: 'รายชื่อ Template',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    templates: {
                      type: 'array',
                      items: { type: 'string' },
                      example: ['รายงาน2356.docx'],
                    },
                  },
                },
              },
            },
          },
          401: { description: 'Unauthorized - ต้องเข้าสู่ระบบก่อน' },
        },
      },
    },
    '/api/generate': {
      post: {
        tags: ['Templates & Documents'],
        summary: 'กรอกข้อมูล JSON ลงในไฟล์ Docx Template และดาวน์โหลดไฟล์ (ต้องเข้าสู่ระบบ)',
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: 'template',
            in: 'query',
            description: 'ชื่อไฟล์ Template (เช่น รายงาน2356.docx)',
            schema: { type: 'string' },
          },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                example: {
                  case_black_no: 'ผบ121/2569',
                  case_red_no: 'ผบ193/2569',
                  court_name: 'ศาลจังหวัดระยอง',
                  date: '5',
                  month: 'ตุลาคม',
                  year: '2569',
                  case_type: 'แพ่ง',
                  plaintiff_name: 'นาย ก',
                  defendant_name: 'บริษัท ก จำกัด',
                  hearing_time: '09.00',
                },
              },
            },
          },
        },
        responses: {
          200: {
            description: 'ไฟล์ Word (.docx) ที่กรอกข้อมูลเสร็จสมบูรณ์',
            content: {
              'application/vnd.openxmlformats-officedocument.wordprocessingml.document': {
                schema: { type: 'string', format: 'binary' },
              },
            },
          },
          401: { description: 'Unauthorized - ต้องเข้าสู่ระบบก่อน' },
          500: { description: 'การประมวลผลล้มเหลว' },
        },
      },
    },
    '/api/test': {
      get: {
        tags: ['Templates & Documents'],
        summary: 'ดาวน์โหลดไฟล์ตัวอย่าง Docx ทดสอบทันทีด้วย Mockup data (ต้องเข้าสู่ระบบ)',
        security: [{ bearerAuth: [] }],
        responses: {
          200: {
            description: 'ไฟล์ Word (.docx) ตัวอย่าง',
            content: {
              'application/vnd.openxmlformats-officedocument.wordprocessingml.document': {
                schema: { type: 'string', format: 'binary' },
              },
            },
          },
          401: { description: 'Unauthorized - ต้องเข้าสู่ระบบก่อน' },
        },
      },
    },
  },
};
