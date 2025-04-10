const QRCode = require('qrcode');
const fs = require('fs');
const path = require('path');

// 現在のホスト名を取得（ローカル開発用）
const host = 'localhost:3000';
const url = `http://${host}/play`;

// QRコードの保存先ディレクトリ
const outputDir = path.join(__dirname, 'public', 'images');
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

// QRコードを生成して保存
QRCode.toFile(
  path.join(outputDir, 'qr-code.png'),
  url,
  {
    color: {
      dark: '#000000',
      light: '#ffffff'
    },
    width: 300,
    margin: 1
  },
  (err) => {
    if (err) {
      console.error('QRコードの生成に失敗しました:', err);
    } else {
      console.log('QRコードが生成されました！');
      console.log('保存場所:', path.join(outputDir, 'qr-code.png'));
      console.log('QRコードURL:', url);
    }
  }
);
