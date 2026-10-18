"use client"

import dynamic from "next/dynamic"

const NaviBot = dynamic(() => import("./NaviBot"), {
  ssr: false,
})

export default function NaviBotWrapper() {
  return <NaviBot />
}
