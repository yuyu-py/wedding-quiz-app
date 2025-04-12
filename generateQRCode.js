// generateQRCode.js

// QRコード生成スクリプト
const QRCode = require('qrcode');
const fs = require('fs');
const path = require('path');

// QRコードに埋め込むURL（ホスト名やポート番号は環境に合わせて変更してください）
const host = '192.168.0.255:3000';  // ここを実際のIPアドレスに変更
const url = `http://${host}/play`;


// 出力先ディレクトリがなければ作成
const outputDir = path.join(__dirname, 'public', 'images');
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

// QRコードを生成
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
  function(err) {
    if (err) {
      console.error('QRコードの生成に失敗しました:', err);
    } else {
      console.log('QRコードが生成されました！');
      console.log('保存場所:', path.join(outputDir, 'qr-code.png'));
    }
  }
);
