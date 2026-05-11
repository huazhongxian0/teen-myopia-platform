const { spawn, spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const DAY_MS = 24 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;

const dbName = process.env.MYSQL_DB || process.env.DB_NAME || 'eyesManager';
const mysqlHost = process.env.MYSQL_HOST || process.env.DB_HOST || '127.0.0.1';
const mysqlPort = process.env.MYSQL_PORT || process.env.DB_PORT || '3306';
const mysqlUser = process.env.MYSQL_USER || process.env.DB_USER || 'root';
const mysqlPassword = process.env.MYSQL_PASSWORD || process.env.DB_PASSWORD || '123456789';

const resolveJavaHome17 = () => {
  const isWindows = process.platform === 'win32';
  const pathSeparator = isWindows ? ';' : ':';

  const tryJavaHome = (javaHome) => {
    if (!javaHome) return null;
    const javaBin = path.join(javaHome, 'bin', isWindows ? 'java.exe' : 'java');
    if (!fs.existsSync(javaBin)) return null;
    const result = spawnSync(javaBin, ['-version'], { encoding: 'utf8' });
    const output = `${result.stdout || ''}\n${result.stderr || ''}`;
    const match = output.match(/version\s+"(\d+)(?:\.(\d+))?/);
    if (!match) return null;
    const major = Number(match[1] === '1' ? match[2] : match[1]);
    if (Number.isFinite(major) && major >= 17) return javaHome;
    return null;
  };

  const envJavaHome = tryJavaHome(process.env.JAVA_HOME);
  if (envJavaHome) return { javaHome: envJavaHome, pathSeparator };

  if (process.platform === 'darwin') {
    const javaHomeResult = spawnSync('/usr/libexec/java_home', ['-v', '17'], { encoding: 'utf8' });
    if (javaHomeResult.status === 0) {
      const candidate = tryJavaHome(String(javaHomeResult.stdout || '').trim());
      if (candidate) return { javaHome: candidate, pathSeparator };
    }

    const brewPrefixResult = spawnSync('brew', ['--prefix', 'openjdk@17'], { encoding: 'utf8', shell: true });
    if (brewPrefixResult.status === 0) {
      const prefix = String(brewPrefixResult.stdout || '').trim();
      const brewJavaHome = path.join(prefix, 'libexec', 'openjdk.jdk', 'Contents', 'Home');
      const candidate = tryJavaHome(brewJavaHome);
      if (candidate) return { javaHome: candidate, pathSeparator };
    }
  }

  return { javaHome: null, pathSeparator };
};

const mysqlArgs = ['-h', mysqlHost, '-P', String(mysqlPort), '-u', mysqlUser];
if (mysqlPassword) {
  mysqlArgs.push(`-p${mysqlPassword}`);
}

function quoteSqlValue(value) {
  if (value === null || value === undefined) return 'NULL';
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : 'NULL';
  if (typeof value === 'boolean') return value ? '1' : '0';
  return `'${String(value).replace(/\\/g, '\\\\').replace(/'/g, "''")}'`;
}

function buildInsertSql(tableName, columns, rows) {
  if (!rows || rows.length === 0) return '';
  const header = `INSERT INTO \`${tableName}\` (${columns.map((column) => `\`${column}\``).join(', ')}) VALUES\n`;
  const values = rows.map((row) => `  (${columns.map((column) => quoteSqlValue(row[column])).join(', ')})`).join(',\n');
  return `${header}${values};\n`;
}

function createPhone(index) {
  return `13${String(100000000 + index).slice(-9)}`;
}

function padNumber(value, size = 2) {
  return String(value).padStart(size, '0');
}

function buildTimeOffset(daysAgo, hour, minute, extraMs = 0) {
  const base = Date.now() - (daysAgo * DAY_MS);
  const date = new Date(base);
  date.setHours(hour, minute, 0, 0);
  return date.getTime() + extraMs;
}

function buildGeneratedSeedSql() {
  const schoolNames = [
    '锦江实验学校',
    '青羊启明学校',
    '金牛育才学校',
    '武侯明德学校',
    '成华向阳学校',
    '高新星河学校',
    '天府润泽学校',
    '龙泉博雅学校',
    '双流求实学校',
    '郫都文华学校',
    '温江知行学校',
    '新都和美学校',
  ];
  const gradeNames = ['一年级', '二年级', '三年级', '四年级', '五年级', '六年级'];
  const classSuffixes = ['一班', '二班', '三班', '四班', '五班', '六班'];
  const tipTopics = ['坐姿提醒', '户外运动', '阅读照明', '屏幕节制', '饮食营养', '睡眠管理', '课间放松', '定期筛查'];

  const config = {
    extraDoctorCount: 12,
    extraTeacherCount: 18,
    schoolCount: schoolNames.length,
    classPerSchool: 6,
    studentPerClass: 8,
    extraTipCount: 55,
    registrationCount: 96,
    historyCount: 84,
  };

  let nextAccountId = 5;
  let nextClassId = 1001;
  let nextClassMapId = 1;
  let nextRegistrationId = 1;
  let nextHistoryId = 1;
  let phoneCursor = 10;

  const doctorAccounts = [];
  const teacherAccounts = [];
  const studentAccounts = [];
  const eyeSightRows = [];
  const schoolRows = [];
  const classMapRows = [];
  const dynamicSqlBlocks = [];
  const studentVisionMap = new Map();

  for (let index = 1; index <= config.extraDoctorCount; index += 1) {
    const accountId = nextAccountId++;
    const degreeBase = 25 + ((index * 17) % 80);
    doctorAccounts.push({
      id: accountId,
      role_id: 'doctor',
      name: `测试医生${padNumber(index)}`,
      account_name: `doctor_test_${padNumber(index, 3)}`,
      password: '123456',
      phone_number: createPhone(phoneCursor++),
      avator_url: `https://example.com/avatar/doctor_${padNumber(index, 3)}.png`,
    });
    eyeSightRows.push({
      id: accountId,
      od: degreeBase,
      os: degreeBase + 10,
      eyes_time: buildTimeOffset(index % 20, 9, 0, index * 1000),
      has_glasses: degreeBase >= 80,
      people_id: accountId,
    });
  }

  for (let index = 1; index <= config.extraTeacherCount; index += 1) {
    const accountId = nextAccountId++;
    const degreeBase = 35 + ((index * 13) % 120);
    teacherAccounts.push({
      id: accountId,
      role_id: 'teacher',
      name: `测试老师${padNumber(index)}`,
      account_name: `teacher_test_${padNumber(index, 3)}`,
      password: '123456',
      phone_number: createPhone(phoneCursor++),
      avator_url: `https://example.com/avatar/teacher_${padNumber(index, 3)}.png`,
    });
    eyeSightRows.push({
      id: accountId,
      od: degreeBase,
      os: degreeBase + 5,
      eyes_time: buildTimeOffset(index % 25, 8, 30, index * 1000),
      has_glasses: degreeBase >= 90,
      people_id: accountId,
    });
  }

  for (let schoolIndex = 0; schoolIndex < config.schoolCount; schoolIndex += 1) {
    const schoolId = schoolIndex + 1;
    const schoolTableName = `school${schoolId}`;
    schoolRows.push({
      id: schoolId,
      name: schoolNames[schoolIndex],
      table_name: schoolTableName,
      created_at: buildTimeOffset(60 - schoolIndex, 9, 0),
    });

    dynamicSqlBlocks.push(`
CREATE TABLE IF NOT EXISTS \`${schoolTableName}\` (
  \`id\` BIGINT NOT NULL AUTO_INCREMENT,
  \`class_table_name\` VARCHAR(255) NOT NULL,
  \`name\` VARCHAR(255) NOT NULL,
  \`head_teacher_account_id\` BIGINT NULL,
  \`created_at\` BIGINT NOT NULL,
  PRIMARY KEY (\`id\`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
`);

    const classRows = [];

    for (let classIndex = 0; classIndex < config.classPerSchool; classIndex += 1) {
      const classId = nextClassId++;
      const classTableName = `school${schoolId}class${classId}`;
      const teacher = teacherAccounts[(schoolIndex * config.classPerSchool + classIndex) % teacherAccounts.length];
      const className = `${gradeNames[classIndex % gradeNames.length]}${classSuffixes[classIndex % classSuffixes.length]}`;

      classRows.push({
        id: classId,
        class_table_name: classTableName,
        name: className,
        head_teacher_account_id: teacher.id,
        created_at: buildTimeOffset(50 - schoolIndex, 10, classIndex * 5),
      });

      dynamicSqlBlocks.push(`
CREATE TABLE IF NOT EXISTS \`${classTableName}\` (
  \`id\` BIGINT NOT NULL AUTO_INCREMENT,
  \`account_id\` BIGINT NOT NULL,
  PRIMARY KEY (\`id\`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
`);

      classMapRows.push({
        id: nextClassMapId++,
        teacher: teacher.account_name,
        classtablename: classTableName,
      });

      const classStudentRows = [];

      for (let studentIndex = 0; studentIndex < config.studentPerClass; studentIndex += 1) {
        const accountId = nextAccountId++;
        const sequence = schoolIndex * config.classPerSchool * config.studentPerClass + classIndex * config.studentPerClass + studentIndex + 1;
        const degreeBase = 60 + ((sequence * 19) % 520);
        const od = degreeBase + ((studentIndex % 3) * 10);
        const os = degreeBase + (((studentIndex + 1) % 3) * 8);
        const hasGlasses = degreeBase >= 180 || sequence % 5 === 0;
        const studentName = `${schoolNames[schoolIndex].replace('学校', '')}${classSuffixes[classIndex % classSuffixes.length]}学生${padNumber(studentIndex + 1)}`;

        studentAccounts.push({
          id: accountId,
          role_id: 'student',
          name: studentName,
          account_name: `student_${schoolId}_${classId}_${padNumber(studentIndex + 1)}`,
          password: '123456',
          phone_number: createPhone(phoneCursor++),
          avator_url: `https://example.com/avatar/student_${padNumber(sequence, 4)}.png`,
        });

        eyeSightRows.push({
          id: accountId,
          od,
          os,
          eyes_time: buildTimeOffset((sequence % 45) + 1, 7 + (studentIndex % 5), (studentIndex % 4) * 10, sequence * 1000),
          has_glasses: hasGlasses,
          people_id: accountId,
        });

        studentVisionMap.set(accountId, { od, os });

        classStudentRows.push({
          id: studentIndex + 1,
          account_id: accountId,
        });
      }

      dynamicSqlBlocks.push(buildInsertSql(classTableName, ['id', 'account_id'], classStudentRows));
    }

    dynamicSqlBlocks.push(buildInsertSql(schoolTableName, ['id', 'class_table_name', 'name', 'head_teacher_account_id', 'created_at'], classRows));
  }

  const visitRegistrationRows = [];
  const visitHistoryRows = [];
  const visitStudents = studentAccounts.slice(0, config.registrationCount);
  const baseDoctorAccountId = 2;

  for (let index = 0; index < visitStudents.length; index += 1) {
    const student = visitStudents[index];
    const doctor = doctorAccounts[index % doctorAccounts.length];
    const visitDate = buildTimeOffset((index % 28) + 1, 8 + (index % 6), (index % 2) * 30, index * 1000);

    visitRegistrationRows.push({
      id: nextRegistrationId,
      doctor_account_id: doctor.id,
      patient_account_id: student.id,
      visit_date: visitDate,
      created_at: visitDate - ((index % 4) + 2) * HOUR_MS,
    });

    if (index < config.historyCount) {
      const vision = studentVisionMap.get(student.id) || { od: 120, os: 120 };
      visitHistoryRows.push({
        id: nextHistoryId++,
        registration_id: nextRegistrationId,
        doctor_account_id: doctor.id,
        patient_account_id: student.id,
        visit_date: visitDate,
        od: Math.max(0, vision.od - ((index % 5) * 5)),
        os: Math.max(0, vision.os - ((index % 4) * 4)),
        created_at: visitDate + HOUR_MS,
      });
    }

    nextRegistrationId += 1;
  }

  // 为基础医生账号“张医生”补充一组更贴近页面交互的预约与诊断数据。
  const baseDoctorPlans = [
    { student: studentAccounts[0], daysAgo: 0, hasHistory: false },
    { student: studentAccounts[1], daysAgo: 0, hasHistory: false },
    { student: studentAccounts[2], daysAgo: 1, hasHistory: true },
    { student: studentAccounts[3], daysAgo: 3, hasHistory: true },
    { student: studentAccounts[4], daysAgo: 5, hasHistory: true },
    { student: studentAccounts[5], daysAgo: 7, hasHistory: true },
  ];

  baseDoctorPlans.forEach((plan, index) => {
    if (!plan.student?.id) return;
    const visitDate = buildTimeOffset(plan.daysAgo, 0, 0, index * 1000);
    const registrationId = nextRegistrationId++;

    visitRegistrationRows.push({
      id: registrationId,
      doctor_account_id: baseDoctorAccountId,
      patient_account_id: plan.student.id,
      visit_date: visitDate,
      created_at: visitDate - ((index % 3) + 4) * HOUR_MS,
    });

    if (!plan.hasHistory) {
      return;
    }

    const vision = studentVisionMap.get(plan.student.id) || { od: 120, os: 120 };
    visitHistoryRows.push({
      id: nextHistoryId++,
      registration_id: registrationId,
      doctor_account_id: baseDoctorAccountId,
      patient_account_id: plan.student.id,
      visit_date: visitDate,
      od: Math.max(40, vision.od - ((index % 4) + 1) * 8),
      os: Math.max(40, vision.os - ((index % 3) + 1) * 6),
      created_at: visitDate + (index + 8) * HOUR_MS,
    });
  });

  const extraTips = [];
  for (let index = 1; index <= config.extraTipCount; index += 1) {
    const topic = tipTopics[index % tipTopics.length];
    extraTips.push({
      id: index + 5,
      title: `护眼专题建议 ${padNumber(index, 2)} · ${topic}`,
      content: `第 ${index} 条护眼建议：围绕${topic}开展班级提醒、家校协同和阶段复查，结合日常用眼时长、户外活动与筛查结果持续跟踪学生视力变化。`,
      created_at: buildTimeOffset(index, 18, index % 60),
    });
  }

  return [
    `USE \`${dbName}\`;`,
    buildInsertSql('account', ['id', 'role_id', 'name', 'account_name', 'password', 'phone_number', 'avator_url'], [
      ...doctorAccounts,
      ...teacherAccounts,
      ...studentAccounts,
    ]),
    buildInsertSql('eyessight', ['id', 'od', 'os', 'eyes_time', 'has_glasses', 'people_id'], eyeSightRows),
    buildInsertSql('school', ['id', 'name', 'table_name', 'created_at'], schoolRows),
    dynamicSqlBlocks.join('\n'),
    buildInsertSql('classmap', ['id', 'teacher', 'classtablename'], classMapRows),
    buildInsertSql('visit_registration', ['id', 'doctor_account_id', 'patient_account_id', 'visit_date', 'created_at'], visitRegistrationRows),
    buildInsertSql('visit_history', ['id', 'registration_id', 'doctor_account_id', 'patient_account_id', 'visit_date', 'od', 'os', 'created_at'], visitHistoryRows),
    buildInsertSql('eye_care_tip', ['id', 'title', 'content', 'created_at'], extraTips),
  ].filter(Boolean).join('\n');
}

function runMysqlScriptFromText(scriptText, onComplete) {
  const scriptRunner = spawn('mysql', mysqlArgs, { stdio: ['pipe', 'inherit', 'inherit'], shell: true });
  scriptRunner.stdin.end(scriptText);

  scriptRunner.on('error', (err) => {
    console.error('测试数据初始化失败:', err);
    process.exit(1);
  });

  scriptRunner.on('close', (code) => {
    onComplete(code);
  });
}

function startServices() {
  console.log('测试数据初始化完成，正在启动后端服务...');

  const { javaHome, pathSeparator } = resolveJavaHome17();
  if (!javaHome) {
    console.error('后端启动失败: 未找到可用的 Java 17+ 运行环境。');
    console.error('请安装并启用 JDK 17+，例如（macOS + Homebrew）：');
    console.error('  brew install openjdk@17');
    console.error('  sudo ln -sfn /opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk /Library/Java/JavaVirtualMachines/openjdk-17.jdk');
    console.error("  export JAVA_HOME=$(/usr/libexec/java_home -v 17)");
    process.exit(1);
  }

  const defaultDbUrl = `jdbc:mysql://${mysqlHost}:${mysqlPort}/${dbName}?useUnicode=true&characterEncoding=utf8&serverTimezone=Asia/Shanghai&useSSL=false&allowPublicKeyRetrieval=true`;

  const serverEnv = {
    ...process.env,
    JAVA_HOME: javaHome,
    PATH: `${path.join(javaHome, 'bin')}${pathSeparator}${process.env.PATH || ''}`,
    DB_URL: process.env.DB_URL || defaultDbUrl,
    DB_USER: process.env.DB_USER || mysqlUser,
    DB_PASSWORD: process.env.DB_PASSWORD || mysqlPassword,
    DB_HOST: process.env.DB_HOST || mysqlHost,
    DB_PORT: process.env.DB_PORT || String(mysqlPort),
    DB_NAME: process.env.DB_NAME || dbName,
  };

  const serverProcess = spawn(process.platform === 'win32' ? 'mvnw.cmd' : './mvnw', ['spring-boot:run'], {
    cwd: path.join(__dirname, '..', 'server'),
    stdio: 'inherit',
    env: serverEnv,
    shell: true
  });

  serverProcess.on('spawn', () => {
    console.log('后端服务已启动，正在启动前端项目...');

    const feProcess = spawn('npm', ['run', 'dev'], {
      cwd: path.join(__dirname, '..', 'fe'),
      stdio: 'inherit',
      shell: true
    });

    feProcess.on('spawn', () => {
      console.log('前端项目已启动，全部初始化完成！');
    });

    feProcess.on('error', (err) => {
      console.error('前端项目启动失败:', err);
    });
  });

  serverProcess.on('error', (err) => {
    console.error('后端服务启动失败:', err);
  });
}

// 1. 运行数据库初始脚本
console.log('正在初始化数据库...');
const sqlFilePath = path.join(__dirname, 'mysql-init.sql');
if (!fs.existsSync(sqlFilePath)) {
  console.error(`找不到数据库初始化脚本: ${sqlFilePath}`);
  process.exit(1);
}

const dbInit = spawn('mysql', mysqlArgs, { stdio: ['pipe', 'inherit', 'inherit'], shell: true });
fs.createReadStream(sqlFilePath).pipe(dbInit.stdin);

dbInit.on('close', (code) => {
  if (code !== 0) {
    console.error(`数据库初始化失败，退出码: ${code}`);
    if (!mysqlPassword) {
      console.error("提示: MySQL 需要密码时，请先设置环境变量 MYSQL_PASSWORD 或 DB_PASSWORD，例如：");
      console.error("  export MYSQL_PASSWORD='你的MySQL密码'");
    }
    process.exit(code);
  }

  console.log('数据库基础结构初始化完成，正在批量生成测试数据...');
  runMysqlScriptFromText(buildGeneratedSeedSql(), (seedCode) => {
    if (seedCode !== 0) {
      console.error(`测试数据初始化失败，退出码: ${seedCode}`);
      process.exit(seedCode);
    }
    startServices();
  });
});
