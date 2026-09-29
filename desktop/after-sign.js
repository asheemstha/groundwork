// No Apple Developer ID, so give the app an ad-hoc signature. Apple Silicon won't run unsigned code;
// with this, macOS only asks once ("Open Anyway") the first time the app is opened.
const { execFileSync } = require('child_process');
const path = require('path');

exports.default = async function (context) {
  if (context.electronPlatformName !== 'darwin') return;
  const app = path.join(context.appOutDir, `${context.packager.appInfo.productFilename}.app`);
  execFileSync('codesign', ['--force', '--deep', '--sign', '-', app], { stdio: 'inherit' });
};
