import { redirect } from "next/navigation"

export default function GateIndexPage() {
  redirect("/gate/verify")
}
