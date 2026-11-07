import { createClient } from '@supabase/supabase-js'
import readline from 'readline'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.resolve(__dirname, '..')

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
})

const question = (query) => new Promise((resolve) => rl.question(query, resolve))

async function run() {
  console.log('\n========================================')
  console.log(' AUCTION NEXUS — AUTOMATED ADMIN SETUP')
  console.log('========================================\n')

  // Check if .env.local already has Supabase URL
  let envContent = ''
  const envPath = path.join(rootDir, '.env.local')
  if (fs.existsSync(envPath)) {
    envContent = fs.readFileSync(envPath, 'utf8')
  }

  const urlMatch = envContent.match(/VITE_SUPABASE_URL=["']?(https:\/\/[^"'\s]+)["']?/)
  const anonMatch = envContent.match(/VITE_SUPABASE_ANON_KEY=["']?([^"'\s]+)["']?/)

  let supabaseUrl = urlMatch ? urlMatch[1] : ''
  let supabaseAnonKey = anonMatch ? anonMatch[1] : ''

  if (!supabaseUrl) {
    supabaseUrl = (await question('1. Enter your Supabase Project URL (e.g. https://xyz.supabase.co): ')).trim()
  } else {
    console.log(`✓ Using Project URL: ${supabaseUrl}`)
  }

  if (!supabaseAnonKey) {
    supabaseAnonKey = (await question('2. Enter your Supabase "anon public" key: ')).trim()
  } else {
    console.log(`✓ Using Anon Key: ${supabaseAnonKey.slice(0, 15)}...`)
  }

  const serviceKey = (await question('3. Enter your Supabase "service_role" secret key (from Project Settings -> API): ')).trim()

  const adminEmail = (await question('4. Enter Admin Email [admin@auction.com]: ')).trim() || 'admin@auction.com'
  const adminPassword = (await question('5. Enter Admin Password [Admin123!]: ')).trim() || 'Admin123!'

  rl.close()

  console.log('\nCreating admin user in Supabase...')

  const supabaseAdmin = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  })

  // 1. Create or get user
  let userId = null
  const { data: userData, error: createError } = await supabaseAdmin.auth.admin.createUser({
    email: adminEmail,
    password: adminPassword,
    email_confirm: true,
  })

  if (createError) {
    if (createError.message && createError.message.toLowerCase().includes('already')) {
      console.log(`User ${adminEmail} already exists. Fetching user ID...`)
      const { data: listData, error: listError } = await supabaseAdmin.auth.admin.listUsers()
      if (listError) throw listError
      const existing = listData.users.find(u => u.email.toLowerCase() === adminEmail.toLowerCase())
      if (existing) {
        userId = existing.id
        // Update password just in case
        await supabaseAdmin.auth.admin.updateUserById(userId, { password: adminPassword })
      }
    } else {
      console.error('Error creating user:', createError.message)
      process.exit(1)
    }
  } else {
    userId = userData.user.id
    console.log(`✓ User created successfully with ID: ${userId}`)
  }

  if (!userId) {
    console.error('Could not determine user ID.')
    process.exit(1)
  }

  // 2. Grant admin role in admin_profiles
  console.log('Granting admin role in admin_profiles table...')
  const { error: profileError } = await supabaseAdmin
    .from('admin_profiles')
    .upsert({
      id: userId,
      role: 'admin',
      email: adminEmail,
    }, { onConflict: 'id' })

  if (profileError) {
    console.error('Note on admin_profiles:', profileError.message)
    console.log('If the table does not exist, make sure to run supabase-setup.sql in Supabase SQL Editor.')
  } else {
    console.log('✓ Admin profile created/updated with role: admin')
  }

  // 3. Update .env.local with Supabase variables
  let updatedEnv = envContent
  if (!updatedEnv.includes('VITE_SUPABASE_URL=')) {
    updatedEnv += `\nVITE_SUPABASE_URL="${supabaseUrl}"`
  } else {
    updatedEnv = updatedEnv.replace(/VITE_SUPABASE_URL=.*(\r?\n|$)/, `VITE_SUPABASE_URL="${supabaseUrl}"$1`)
  }

  if (!updatedEnv.includes('VITE_SUPABASE_ANON_KEY=')) {
    updatedEnv += `\nVITE_SUPABASE_ANON_KEY="${supabaseAnonKey}"`
  } else {
    updatedEnv = updatedEnv.replace(/VITE_SUPABASE_ANON_KEY=.*(\r?\n|$)/, `VITE_SUPABASE_ANON_KEY="${supabaseAnonKey}"$1`)
  }

  fs.writeFileSync(envPath, updatedEnv.trim() + '\n')
  console.log('✓ Updated .env.local with VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY')

  console.log('\n======================================================')
  console.log(' SUCCESS! ADMIN ACCOUNT IS READY TO USE')
  console.log('======================================================')
  console.log(`Email:    ${adminEmail}`)
  console.log(`Password: ${adminPassword}`)
  console.log('Login at: /admin/login')
  console.log('======================================================\n')
}

run().catch(err => {
  console.error('Unexpected error:', err)
  process.exit(1)
})

