import { Html, Head, Main, NextScript } from 'next/document';
export default function Document() {
  return (
    <Html lang="zh-CN">
      <Head>
        <link rel="icon" href="/favicon.svg" />
        <meta name="theme-color" content="#111827" />
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
