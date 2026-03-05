import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: '你家的水，從哪裡來？ | ReRiver 臺灣自來水水源查詢',
  description: '讓我們與河流重修舊好 - 探索臺灣自來水的源頭，了解您家中水源的來源與管理',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="zh-TW">
      <body className="antialiased">
        {children}
      </body>
    </html>
  )
}
