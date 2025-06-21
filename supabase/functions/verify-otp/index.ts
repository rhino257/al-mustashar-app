/// <reference lib="deno.ns" />
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Inlined CORS headers
export const corsHeaders = {
  'Access-Control-Allow-Origin': '*', 
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS, PUT, DELETE',
};

serve(async (req: Request) => {
  console.log(`verify-otp: Function invoked at ${new Date().toISOString()}`); // LOG AT THE VERY START

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { phone, otp } = await req.json();
    if (!phone || !otp) {
      return new Response(JSON.stringify({ error: 'Phone number and OTP are required' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseServiceRoleKey) {
      console.error('Missing Supabase environment variables. Check SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.');
      return new Response(JSON.stringify({ error: 'Internal server configuration error.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      });
    }
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey);

    const { data: otpEntry, error: otpError } = await supabaseAdmin
      .from('otp_verification')
      .select('code, expires_at, attempts')
      .eq('phone', phone)
      .single();

    if (otpError || !otpEntry) {
      console.error(`verify-otp: Error fetching OTP entry for phone ${phone} or entry not found. Error: ${JSON.stringify(otpError)}`);
      return new Response(JSON.stringify({ error: 'Invalid phone number or OTP not requested/found.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 401, 
      });
    }

    const now = new Date(); 
    const otpExpiresAt = new Date(otpEntry.expires_at); 

    console.log(`verify-otp: OTP expires_at from DB: ${otpEntry.expires_at} (Parsed as: ${otpExpiresAt.toISOString()})`);
    console.log(`verify-otp: Current server time for comparison: ${now.toISOString()}`);

    if (otpExpiresAt < now) {
      console.log(`verify-otp: OTP determined to be expired. Expires: ${otpExpiresAt.toISOString()}, Now: ${now.toISOString()}`);
      return new Response(JSON.stringify({ error: 'OTP has expired.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 401, 
      });
    }

    if (otpEntry.attempts >= 5) { 
      console.log(`verify-otp: Too many attempts for phone ${phone}. Attempts: ${otpEntry.attempts}`);
      return new Response(JSON.stringify({ error: 'Too many OTP attempts.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 429, 
      });
    }

    if (otpEntry.code !== otp) {
      console.log(`verify-otp: Invalid OTP for phone ${phone}. Expected: ${otpEntry.code}, Got: ${otp}`);
      await supabaseAdmin
        .from('otp_verification')
        .update({ attempts: otpEntry.attempts + 1 })
        .eq('phone', phone);
      return new Response(JSON.stringify({ error: 'Invalid OTP.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 401, 
      });
    }

    console.log(`verify-otp: OTP ${otp} for phone ${phone} is valid. Deleting entry.`);
    await supabaseAdmin.from('otp_verification').delete().eq('phone', phone);

    let userId: string | undefined;
    const { data: { users: existingUsers }, error: listUsersError } = await supabaseAdmin.auth.admin.listUsers({
      phone: phone, 
    });

    if (listUsersError) {
        console.error(`verify-otp: Error listing users by phone ${phone}:`, listUsersError);
        throw listUsersError;
    }
    
    const existingUser = existingUsers && existingUsers.length > 0 ? existingUsers[0] : null;

    if (existingUser) {
      userId = existingUser.id;
      console.log(`verify-otp: Existing user found for phone ${phone}. User ID: ${userId}`);
    } else {
      console.log(`verify-otp: No existing user for phone ${phone}. Creating new user.`);
      const tempPassword = crypto.randomUUID(); 
      const { data: newUserResponse, error: createUserError } = await supabaseAdmin.auth.admin.createUser({
        phone: phone,
        phone_confirm: true, 
        password: tempPassword,
      });

      if (createUserError) {
        console.error(`verify-otp: Error creating user for phone ${phone}:`, createUserError);
        throw createUserError;
      }
      if (!newUserResponse || !newUserResponse.user) {
        throw new Error('User creation did not return a user object.');
      }
      userId = newUserResponse.user.id;
      console.log(`verify-otp: New user created for phone ${phone}. User ID: ${userId}`);
    }

    if (!userId) {
      // This case should ideally not be reached if logic above is correct
      console.error(`verify-otp: User ID not found or created for phone ${phone}.`);
      throw new Error('User could not be created or found.');
    }

    console.log(`verify-otp: Generating magic link for user ID ${userId}, phone ${phone}.`);
    const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
      type: 'magiclink',
      phone: phone, 
    });

    if (linkError) {
      console.error(`verify-otp: Error generating magic link for phone ${phone}:`, linkError);
      throw linkError;
    }

    const magicLink = linkData.properties?.action_link;
    if (!magicLink) {
        console.error(`verify-otp: Failed to get action_link from generateLink response for phone ${phone}.`);
        throw new Error('Failed to generate magic link action URL.');
    }
    console.log(`verify-otp: Magic link generated for phone ${phone}: ${magicLink}`);

    return new Response(JSON.stringify({ 
      message: 'Verification successful. Use the magic link to complete login.', 
      magicLink: magicLink 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error: any) {
    console.error('Error in verify-otp function:', error.message, error.stack);
    return new Response(JSON.stringify({ error: error.message || 'An unexpected error occurred' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
})
