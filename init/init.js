const { spawn, spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

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

// 1. 运行数据库初始脚本
console.log('正在初始化数据库...');
const sqlFilePath = path.join(__dirname, 'mysql-init.sql');
if (!fs.existsSync(sqlFilePath)) {
  console.error(`找不到数据库初始化脚本: ${sqlFilePath}`);
  process.exit(1);
}

const mysqlHost = process.env.MYSQL_HOST || process.env.DB_HOST || '127.0.0.1';
const mysqlPort = process.env.MYSQL_PORT || process.env.DB_PORT || '3306';
const mysqlUser = process.env.MYSQL_USER || process.env.DB_USER || 'root';
const mysqlPassword = process.env.MYSQL_PASSWORD || process.env.DB_PASSWORD || '123456789';

const mysqlArgs = ['-h', mysqlHost, '-P', String(mysqlPort), '-u', mysqlUser];
if (mysqlPassword) {
  mysqlArgs.push(`-p${mysqlPassword}`);
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

  console.log('数据库初始化完成，正在启动后端服务...');

  // 2. 启动后端服务
  const { javaHome, pathSeparator } = resolveJavaHome17();
  if (!javaHome) {
    console.error('后端启动失败: 未找到可用的 Java 17+ 运行环境。');
    console.error('请安装并启用 JDK 17+，例如（macOS + Homebrew）：');
    console.error('  brew install openjdk@17');
    console.error('  sudo ln -sfn /opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk /Library/Java/JavaVirtualMachines/openjdk-17.jdk');
    console.error("  export JAVA_HOME=$(/usr/libexec/java_home -v 17)");
    process.exit(1);
  }

  const dbName = process.env.MYSQL_DB || process.env.DB_NAME || 'eyesManager';
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

    // 3. 启动前端项目
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
});
