/// <reference lib="deno.ns" />
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

const OTP_TEMPLATE_NAME = 'almustashar_otp';
const OTP_TEMPLATE_LANGUAGE_CODE = 'ar';
const OTP_EXPIRY_MINUTES = 10; // Match template message

serve(async (req: Request) => {
  console.log(`request-otp: Function invoked at ${new Date().toISOString()}`); // LOG AT THE VERY START

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { phone } = await req.json()
    if (!phone) {
      return new Response(JSON.stringify({ error: 'Phone number is required' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      })
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const whatsappToken = Deno.env.get('WHATSAPP_ACCESS_TOKEN');
    const whatsappPhoneNumberId = Deno.env.get('WHATSAPP_PHONE_NUMBER_ID');

    if (!supabaseUrl || !supabaseServiceRoleKey || !whatsappToken || !whatsappPhoneNumberId) {
      console.error('Missing environment variables. Check SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, WHATSAPP_ACCESS_TOKEN, WHATSAPP_PHONE_NUMBER_ID');
      return new Response(JSON.stringify({ error: 'Internal server configuration error.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      });
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey);

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const currentTime = new Date();
    const expiresAt = new Date(currentTime.getTime() + OTP_EXPIRY_MINUTES * 60 * 1000);

    console.log(`request-otp: Current server time: ${currentTime.toISOString()}`);
    console.log(`request-otp: OTP generated: ${otp}`);
    console.log(`request-otp: OTP will expire at (calculated): ${expiresAt.toISOString()}`);

    const { error: storeError } = await supabaseAdmin
      .from('otp_verification')
      .upsert({
        phone: phone,
        code: otp,
        expires_at: expiresAt.toISOString(),
        attempts: 0,
      }, { onConflict: 'phone' });

    if (storeError) {
      console.error('Error storing OTP:', storeError);
      throw storeError;
    }

    // Send OTP via WhatsApp Cloud API
    const whatsappApiUrl = `https://graph.facebook.com/v19.0/${whatsappPhoneNumberId}/messages`;

    const response = await fetch(whatsappApiUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${whatsappToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: phone, 
        type: 'template',
        template: {
          name: OTP_TEMPLATE_NAME,
          language: { code: OTP_TEMPLATE_LANGUAGE_CODE },
          components: [
            {
              type: 'body',
              parameters: [{ type: 'text', text: otp }]
            },
            {
              type: 'button',
              sub_type: 'url',
              index: "0", // Ensure index is a string
              parameters: [
                {
                  type: 'text',
                  // This is the placeholder value for the URL button.
                  // You MUST verify what your template actually expects here.
                  // If it's just a generic suffix, use that.
                  // Using the OTP here as an example, but consider if this is appropriate.
                  // A safer bet might be a static string like "action" or "verify".
                  text: otp // Example: using OTP as the dynamic part of the URL.
                                  // OR a static value like "copy_code" if the button URL is fixed
                                  // up to a dynamic suffix.
                }
              ]
            }
          ]
        }
      })
    });

    if (!response.ok) {
      const errorBody = await response.json(); 
      console.error('WhatsApp API Error:', errorBody);
      throw new Error(`WhatsApp API error: ${response.status} - ${JSON.stringify(errorBody)}`);
    }
    // const responseData = await response.json();
    // console.log('WhatsApp message sent successfully:', responseData);

    return new Response(JSON.stringify({ message: 'OTP sent successfully - V2 LOG TEST' }), { // MODIFIED SUCCESS MESSAGE
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })
  } catch (error: any) {
    console.error('Error in request-otp function:', error.message, error.stack);
    return new Response(JSON.stringify({ error: error.message || 'An unexpected error occurred' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})
