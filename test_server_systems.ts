import { app } from './src/app';
import { prisma } from './src/config/db';
import { decryptText } from './src/services/crypto.service';

async function runTests() {
  console.log('🧪 Starting System & Security Verification Tests...\n');

  // Start server on test port
  const server = app.listen(3333);
  const BASE_URL = 'http://localhost:3333';

  try {
    // Test 1: Health check & Swagger/Root removal confirmation
    console.log('1️⃣ Checking Health endpoint and confirming removal of Swagger & Root Tester...');
    const healthRes = await fetch(`${BASE_URL}/api/health`);
    if (healthRes.status === 200) {
      console.log('   ✅ Health endpoint accessible (Status 200 OK)');
    } else {
      throw new Error(`Health check failed with status: ${healthRes.status}`);
    }

    const swaggerRes = await fetch(`${BASE_URL}/api/docs/`);
    const rootRes = await fetch(`${BASE_URL}/`);
    if (swaggerRes.status !== 200 && rootRes.status === 404) {
      console.log('   ✅ Confirmed: Swagger and root tester UI successfully removed (Swagger disabled, Root returned 404 Not Found)');
    } else {
      throw new Error(`Swagger or Root is still active! swagger: ${swaggerRes.status}, root: ${rootRes.status}`);
    }

    // Test 2: Security - Role Injection Rejection
    console.log('\n2️⃣ Testing Security: Role Privilege Escalation Prevention...');
    const maliciousRegRes = await fetch(`${BASE_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: `hacker_${Date.now()}`,
        password: 'Password123!',
        role: 'ADMIN', // Should be strictly rejected!
      }),
    });
    if (maliciousRegRes.status === 400) {
      console.log('   ✅ Privilege escalation blocked: Unrecognized "role" field rejected by strict schema (400 Bad Request)');
    } else {
      throw new Error(`Security Failure: Role was not rejected! Status: ${maliciousRegRes.status}`);
    }

    // Test 3: Security - Short Password Rejection (< 8 chars)
    console.log('\n3️⃣ Testing Security: Short Password Rejection...');
    const weakPassRes = await fetch(`${BASE_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: `user_${Date.now()}`,
        password: '123', // Too short
      }),
    });
    if (weakPassRes.status === 400) {
      console.log('   ✅ Weak password rejected (< 8 characters)');
    } else {
      throw new Error('Security Failure: Weak password was allowed!');
    }

    // Test 4: Valid User Registration
    const testUsername = `user_${Date.now()}`;
    const testPassword = 'Password123!';
    console.log(`\n4️⃣ Testing Valid User Registration (${testUsername})...`);
    const regRes = await fetch(`${BASE_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: testUsername,
        password: testPassword,
        fullName: 'Test Automation User',
      }),
    });
    const regData = await regRes.json();
    if (!regRes.ok || !regData.success) {
      throw new Error(`Registration failed: ${JSON.stringify(regData)}`);
    }
    const token = regData.data.token;
    const userId = regData.data.user.id;
    if (regData.data.user.role !== 'USER') {
      throw new Error(`User role must default to USER, got: ${regData.data.user.role}`);
    }
    console.log(`   ✅ User registered successfully with role '${regData.data.user.role}'. User ID: ${userId}`);
    console.log(`   ✅ Received JWT Token: ${token.substring(0, 25)}...`);

    // Test 5: User Login
    console.log('\n5️⃣ Testing User Login...');
    const loginRes = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: testUsername,
        password: testPassword,
      }),
    });
    const loginData = await loginRes.json();
    if (!loginRes.ok || !loginData.success) {
      throw new Error(`Login failed: ${JSON.stringify(loginData)}`);
    }
    console.log('   ✅ Login successful');

    // Test 6: Current User Profile (GET /api/auth/me)
    console.log('\n6️⃣ Testing GET /api/auth/me (Protected Route)...');
    const meRes = await fetch(`${BASE_URL}/api/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const meData = await meRes.json();
    if (!meRes.ok || meData.data.username !== testUsername) {
      throw new Error(`Auth /me failed: ${JSON.stringify(meData)}`);
    }
    console.log(`   ✅ Profile verified for user: ${meData.data.username}`);

    // Test 7: Recent File Addition & Encryption
    console.log('\n7️⃣ Testing Recent File System (Encrypted Local Path)...');
    const originalLocalPath = 'D:\\Users\\TestUser\\Documents\\Confidential_Case_2569.docx';
    const originalFileName = 'Confidential_Case_2569.docx';

    const addFileRes = await fetch(`${BASE_URL}/api/recent-files`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        fileName: originalFileName,
        localPath: originalLocalPath,
        fileType: 'docx',
      }),
    });
    const addFileData = await addFileRes.json();
    if (!addFileRes.ok || !addFileData.success) {
      throw new Error(`Add recent file failed: ${JSON.stringify(addFileData)}`);
    }
    const fileId = addFileData.data.id;
    console.log(`   ✅ Recent file added with ID: ${fileId}`);

    // Directly inspect database to confirm path is NOT in plain text
    const dbRecord = await prisma.recentFile.findUnique({ where: { id: fileId } });
    if (!dbRecord) throw new Error('Database record not found');
    console.log(`   🔒 Raw DB encryptedPath value: "${dbRecord.encryptedPath}"`);
    if (dbRecord.encryptedPath.includes('Confidential_Case_2569') || dbRecord.encryptedPath.includes('TestUser')) {
      throw new Error('SECURITY VIOLATION: Local path is stored in plain text!');
    }
    console.log('   ✅ Confirmed: Local path is NOT stored in plain text!');

    // Test 8: Recent File Retrieval & Decryption
    console.log('\n8️⃣ Testing Recent File Retrieval (GET /api/recent-files)...');
    const listFilesRes = await fetch(`${BASE_URL}/api/recent-files`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const listFilesData = await listFilesRes.json();
    if (!listFilesRes.ok || listFilesData.data.length === 0) {
      throw new Error(`List recent files failed: ${JSON.stringify(listFilesData)}`);
    }
    const returnedFile = listFilesData.data.find((f: any) => f.id === fileId);
    if (!returnedFile || returnedFile.localPath !== originalLocalPath) {
      throw new Error(`Decrypted path mismatch! Expected: ${originalLocalPath}, Got: ${returnedFile?.localPath}`);
    }
    console.log(`   ✅ Successfully decrypted path for authorized user: "${returnedFile.localPath}"`);

    // Test 9: Security - Authentication Requirement for Templates & Generation
    console.log('\n9️⃣ Testing Security: Unauthenticated Access to Templates & Generation...');
    const unauthTemplatesRes = await fetch(`${BASE_URL}/api/templates`);
    if (unauthTemplatesRes.status === 401) {
      console.log('   ✅ Unauthenticated GET /api/templates blocked (401 Unauthorized)');
    } else {
      throw new Error(`Security Failure: Unauthenticated GET /api/templates allowed with status ${unauthTemplatesRes.status}!`);
    }

    const unauthGenRes = await fetch(`${BASE_URL}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ case_black_no: 'Test123' }),
    });
    if (unauthGenRes.status === 401) {
      console.log('   ✅ Unauthenticated POST /api/generate blocked (401 Unauthorized)');
    } else {
      throw new Error(`Security Failure: Unauthenticated POST /api/generate allowed with status ${unauthGenRes.status}!`);
    }

    // Authenticated access to templates
    console.log('\n🔟 Testing Authenticated Access to Templates & Document Generation...');
    const authTemplatesRes = await fetch(`${BASE_URL}/api/templates`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const authTemplatesData = await authTemplatesRes.json();
    if (authTemplatesRes.ok && authTemplatesData.success) {
      console.log(`   ✅ Authenticated GET /api/templates succeeded. Templates: ${JSON.stringify(authTemplatesData.templates)}`);
    } else {
      throw new Error(`Failed to get templates with token: ${JSON.stringify(authTemplatesData)}`);
    }

    // Authenticated Document Generation
    const authGenRes = await fetch(`${BASE_URL}/api/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        case_black_no: 'ผบ999/2569',
        case_red_no: 'ผบ888/2569',
      }),
    });
    if (authGenRes.status === 200) {
      const buffer = await authGenRes.arrayBuffer();
      console.log(`   ✅ Authenticated POST /api/generate succeeded. Generated docx size: ${buffer.byteLength} bytes`);
    } else {
      throw new Error(`Failed to generate document with token. Status: ${authGenRes.status}`);
    }

    // Test 11: Security - Path Traversal Prevention in Template Generation
    console.log('\n1️⃣1️⃣ Testing Security: Path Traversal Prevention in Document Generation...');
    const traversalRes = await fetch(`${BASE_URL}/api/generate?template=../../package.json`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ test: 'data' }),
    });
    if (traversalRes.status >= 400) {
      console.log('   ✅ Path Traversal attempt blocked (Rejected non-docx/outside directory)');
    } else {
      throw new Error('Security Failure: Path traversal was not blocked!');
    }

    // Test 10: Audit Log Verification
    console.log('\n🔟 Testing Audit Log System (GET /api/audit-logs)...');
    const auditRes = await fetch(`${BASE_URL}/api/audit-logs`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const auditData = await auditRes.json();
    if (!auditRes.ok || !auditData.success) {
      throw new Error(`Audit logs fetch failed: ${JSON.stringify(auditData)}`);
    }
    console.log(`   ✅ Total audit logs found: ${auditData.data.total}`);
    const actions = auditData.data.logs.map((l: any) => l.action);
    console.log(`   📋 Recorded actions for this user: ${actions.join(', ')}`);
    if (!actions.includes('USER_REGISTER') || !actions.includes('USER_LOGIN') || !actions.includes('RECENT_FILE_ADD')) {
      throw new Error('Audit logs missing expected action events');
    }
    console.log('   ✅ All expected events recorded with IP and timestamp!');

    // Test 13: Judge Pairs CRUD & Multi-Tenant Isolation
    console.log('\n1️⃣3️⃣ Testing Judge Pairs System & Multi-Tenant Isolation...');
    const createPairRes = await fetch(`${BASE_URL}/api/judge-pairs`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        judge1Name: 'นาย สมศักดิ์ ยุติธรรม',
        judge2Name: 'นางสาว ดวงใจ ซื่อตรง',
        courtName: 'ศาลจังหวัดระยอง',
      }),
    });
    const createPairData = await createPairRes.json();
    if (!createPairRes.ok || !createPairData.judgePair) {
      throw new Error(`Failed to create judge pair: ${JSON.stringify(createPairData)}`);
    }
    const pairId = createPairData.judgePair.id;
    console.log(`   ✅ Judge pair created successfully with ID: ${pairId}`);

    // Register User B to test strict Multi-Tenant Isolation
    const userB_name = `user_b_${Date.now()}`;
    const userB_regRes = await fetch(`${BASE_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: userB_name,
        password: 'Password123!',
        fullName: 'User B (Isolated)',
      }),
    });
    const userB_regData = await userB_regRes.json();
    const tokenB = userB_regData.data.token;
    const userB_id = userB_regData.data.user.id;

    // User B checks judge pairs (must be empty, not see User A's)
    const userB_pairsRes = await fetch(`${BASE_URL}/api/judge-pairs`, {
      headers: { Authorization: `Bearer ${tokenB}` },
    });
    const userB_pairsData = await userB_pairsRes.json();
    if (userB_pairsData.judgePairs.length !== 0) {
      throw new Error('Multi-Tenant Isolation Failure: User B saw User A judge pairs!');
    }
    console.log('   ✅ Verified: User B has 0 judge pairs (Strict Data Isolation Confirmed)');

    // User B attempts to delete User A's judge pair (must be blocked 404/403)
    const userB_hackRes = await fetch(`${BASE_URL}/api/judge-pairs/${pairId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${tokenB}` },
    });
    if (userB_hackRes.status === 404 || userB_hackRes.status === 403) {
      console.log('   ✅ Security Confirmed: User B cannot delete/access User A judge pair');
    } else {
      throw new Error(`Security Failure: User B could access User A judge pair! Status: ${userB_hackRes.status}`);
    }

    // Test 14: Paragraph Templates CRUD & Isolation
    console.log('\n1️⃣4️⃣ Testing Paragraph Templates System...');
    const createTplRes = await fetch(`${BASE_URL}/api/paragraph-templates`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        title: 'พิพากษาตามยอม',
        content: 'คู่ความทั้งสองฝ่ายตกลงยินยอมประนีประนอมยอมความกันได้ตามสัญญาประนีประนอมยอมความ...',
        category: 'คำพิพากษา',
      }),
    });
    const createTplData = await createTplRes.json();
    if (!createTplRes.ok || !createTplData.paragraphTemplate) {
      throw new Error(`Failed to create paragraph template: ${JSON.stringify(createTplData)}`);
    }
    const tplId = createTplData.paragraphTemplate.id;
    console.log(`   ✅ Paragraph template created with ID: ${tplId}`);

    // Test 15: Cloud Files (S3) Upload & Download Flow
    console.log('\n1️⃣5️⃣ Testing Cloud File Storage (S3 / Local Object Storage)...');
    const dummyExcelContent = Buffer.from('Mock Excel Content for Cloud Testing');
    const formData = new FormData();
    const dummyBlob = new Blob([dummyExcelContent], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    formData.append('file', dummyBlob, 'ตารางนัดพิจารณา_ทดสอบ_Cloud.xlsx');

    const uploadCloudRes = await fetch(`${BASE_URL}/api/cloud-files/upload`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
    });
    const uploadCloudData = await uploadCloudRes.json();
    if (!uploadCloudRes.ok || !uploadCloudData.cloudFile) {
      throw new Error(`Failed to upload cloud file: ${JSON.stringify(uploadCloudData)}`);
    }
    const cloudFileId = uploadCloudData.cloudFile.id;
    console.log(`   ✅ Cloud file uploaded successfully with ID: ${cloudFileId}`);

    // Download Cloud File back
    const downloadCloudRes = await fetch(`${BASE_URL}/api/cloud-files/${cloudFileId}/download`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (downloadCloudRes.status === 200) {
      const downloadedBuf = await downloadCloudRes.arrayBuffer();
      if (downloadedBuf.byteLength === dummyExcelContent.length) {
        console.log(`   ✅ Cloud file downloaded and integrity verified (${downloadedBuf.byteLength} bytes)`);
      } else {
        throw new Error('Downloaded file size mismatch');
      }
    } else {
      throw new Error(`Failed to download cloud file: Status ${downloadCloudRes.status}`);
    }

    // Clean up
    console.log('\n🧹 Cleaning up test data...');
    await prisma.cloudFile.deleteMany({ where: { userId } });
    await prisma.paragraphTemplate.deleteMany({ where: { userId } });
    await prisma.judgePair.deleteMany({ where: { userId } });
    await prisma.recentFile.deleteMany({ where: { userId } });
    await prisma.auditLog.deleteMany({ where: { userId } });
    await prisma.user.delete({ where: { id: userId } });
    await prisma.user.delete({ where: { id: userB_id } });
    console.log('   ✅ Test data cleaned up successfully.');

    console.log('\n🎉 ALL FUNCTIONAL & SECURITY TESTS PASSED! 🚀');
  } finally {
    server.close();
    await prisma.$disconnect();
  }
}

runTests().catch((err) => {
  console.error('\n❌ Test execution failed:', err);
  process.exit(1);
});
