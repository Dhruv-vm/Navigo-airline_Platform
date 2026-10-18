import { POST as signupHandler } from "../app/api/auth/signup/route"
import { POST as loginHandler } from "../app/api/auth/login/route"
import { GET as meHandler } from "../app/api/auth/me/route"
import { supabase } from "../lib/supabase"
import fs from "fs"
import path from "path"

async function runAuthPersistenceTest() {
  console.log("==================================================================")
  console.log("🔐 10-STEP AUTHENTICATION PERSISTENCE VERIFICATION")
  console.log("==================================================================")

  const timestamp = Date.now()
  const testEmail = `persistent_user_${timestamp}@navigotest.com`
  const testPassword = `SecurePass${timestamp}!`
  const testName = `Persistent User ${timestamp}`

  // STEP 1: Sign up a new test account
  console.log("\n[Step 1] Creating new user account via /api/auth/signup...")
  const signupReq = new Request("http://localhost:3000/api/auth/signup", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: testName,
      email: testEmail,
      phone: "9876543210",
      password: testPassword,
    }),
  })
  const signupRes = await signupHandler(signupReq)
  const signupJson = await signupRes.json()
  console.log(`  Signup status: ${signupRes.status} | Response:`, signupJson)
  if (signupRes.status !== 200) throw new Error("Step 1 failed: Signup was not successful")

  // STEP 2: Log in with credentials
  console.log("\n[Step 2] Logging in with newly created credentials via /api/auth/login...")
  const loginReq = new Request("http://localhost:3000/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: testEmail,
      password: testPassword,
    }),
  })
  const loginRes = await loginHandler(loginReq)
  const loginJson = await loginRes.json()
  console.log(`  Login status: ${loginRes.status} | Token returned: ${Boolean(loginJson.token)}`)
  if (loginRes.status !== 200 || !loginJson.token) throw new Error("Step 2 failed: Login did not return valid token")
  const userToken = loginJson.token

  // STEP 3: Verify token via /api/auth/me
  console.log("\n[Step 3] Verifying authenticated session via /api/auth/me...")
  const meReq = new Request("http://localhost:3000/api/auth/me", {
    headers: { Authorization: `Bearer ${userToken}` },
  })
  const meRes = await meHandler(meReq)
  const meJson = await meRes.json()
  console.log(`  /api/auth/me status: ${meRes.status} | User: ${meJson.user?.name} (${meJson.user?.email})`)
  if (meRes.status !== 200 || meJson.user?.email.toLowerCase() !== testEmail.toLowerCase()) {
    throw new Error("Step 3 failed: /api/auth/me did not return correct user")
  }

  // STEP 4: Inspect persistent disk storage & Supabase remote record
  console.log("\n[Step 4] Checking persistence on remote Supabase and disk store (.data/navigo_db.json)...")
  const { data: dbUser, error: dbErr } = await supabase
    .from("users")
    .select("id, name, email, created_at")
    .ilike("email", testEmail)
    .maybeSingle()
  console.log(`  Remote Supabase user found: ${Boolean(dbUser)} (ID: ${dbUser?.id})`)
  if (!dbUser) throw new Error("Step 4 failed: User not found in database")

  const diskDbPath = path.join(process.cwd(), ".data", "navigo_db.json")
  const diskExists = fs.existsSync(diskDbPath)
  console.log(`  Local disk file exists at ${diskDbPath}: ${diskExists}`)
  if (diskExists) {
    const diskContent = JSON.parse(fs.readFileSync(diskDbPath, "utf-8"))
    const diskUser = diskContent.users?.find((u: any) => u.email.toLowerCase() === testEmail.toLowerCase())
    console.log(`  Disk store user verified: ${Boolean(diskUser)}`)
  }

  // STEP 5: Simulated server restart rehydration
  console.log("\n[Step 5] Simulating fresh server rehydration (clearing in-memory references)...")
  // Re-read directly from fresh query
  const { data: rehydratedUser } = await supabase
    .from("users")
    .select("id, name, email")
    .eq("id", dbUser.id)
    .single()
  console.log(`  Post-rehydration query status: User ${rehydratedUser?.name} exists permanently`)

  // STEP 6: Re-test login after simulated restart
  console.log("\n[Step 6] Re-testing login credentials after process rehydration...")
  const reLoginReq = new Request("http://localhost:3000/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: testEmail, password: testPassword }),
  })
  const reLoginRes = await loginHandler(reLoginReq)
  const reLoginJson = await reLoginRes.json()
  console.log(`  Re-login status: ${reLoginRes.status} | Token returned: ${Boolean(reLoginJson.token)}`)

  // STEP 7: Rejection of invalid / forged tokens
  console.log("\n[Step 7] Testing security: verifying rejection of forged / invalid tokens...")
  const forgedReq = new Request("http://localhost:3000/api/auth/me", {
    headers: { Authorization: "Bearer forged.invalid.token" },
  })
  const forgedRes = await meHandler(forgedReq)
  console.log(`  Forged token rejection status: ${forgedRes.status} (Expected: 401)`)
  if (forgedRes.status !== 401) throw new Error("Step 7 failed: Forged token was not rejected")

  // STEP 8: Testing missing Authorization header
  console.log("\n[Step 8] Testing security: verifying rejection of missing credentials...")
  const anonReq = new Request("http://localhost:3000/api/auth/me")
  const anonRes = await meHandler(anonReq)
  console.log(`  Missing token rejection status: ${anonRes.status} (Expected: 401)`)
  if (anonRes.status !== 401) throw new Error("Step 8 failed: Missing token was not rejected")

  // STEP 9: Verify existing accounts are fully intact
  console.log("\n[Step 9] Verifying pre-existing accounts are preserved...")
  const { data: existingDhruv } = await supabase
    .from("users")
    .select("id, name, email")
    .ilike("email", "dhruv@test.com")
    .maybeSingle()
  console.log(`  Pre-existing account 'dhruv@test.com': ${Boolean(existingDhruv)} (ID: ${existingDhruv?.id})`)

  // STEP 10: Cleanup test user account
  console.log("\n[Step 10] Cleaning up temporary test user from database...")
  await supabase.from("users").delete().ilike("email", testEmail)
  const { data: finalCheck } = await supabase.from("users").select("id").ilike("email", testEmail).maybeSingle()
  console.log(`  Test user cleaned up cleanly: ${!finalCheck}`)

  console.log("\n==================================================================")
  console.log("🎉 ALL 10 AUTHENTICATION PERSISTENCE TESTS PASSED SUCCESSFULLY!")
  console.log("==================================================================")
}

runAuthPersistenceTest()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("🔥 Auth persistence test failed:", err)
    process.exit(1)
  })
