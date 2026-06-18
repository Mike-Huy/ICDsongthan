import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://jhebreoxwuimlqwvjdok.supabase.co';
const supabaseKey = 'sb_publishable_ycoHhRg7v4s11N6AKoUsEA_9wLW6L1s';

export const supabase = createClient(supabaseUrl, supabaseKey);
