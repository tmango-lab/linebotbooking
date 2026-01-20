
import fs from 'fs';
import path from 'path';
import Papa from 'papaparse';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';

// Load environment variables from .env file
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase credentials in .env');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Paths to CSV files (adjust relative path as needed)
// Script is in /scripts, project root is .., CSVs are in ../GAS
const GAS_DIR = path.resolve(__dirname, '../GAS');

async function migrateBookings() {
    console.log('Migrating Bookings...');
    const csvPath = path.join(GAS_DIR, 'TMG_Bookings - booking.csv');

    if (!fs.existsSync(csvPath)) {
        console.error(`File not found: ${csvPath}`);
        return;
    }

    const csvContent = fs.readFileSync(csvPath, 'utf-8');

    const { data } = Papa.parse(csvContent, { header: true, skipEmptyLines: true });

    const records = data.map((row: any) => ({
        booking_id: row.booking_id,
        user_id: row.user_id,
        display_name: row.display_name || null,
        field_no: row.field_no ? parseInt(row.field_no) : null,
        booking_date: row.date || null, // CSV header 'date' maps to 'booking_date'
        time_from: row.time_from || null,
        time_to: row.time_to || null,
        duration_minutes: row.duration_h ? parseFloat(row.duration_h) * 60 : null, // Convert hours to minutes if needed, schema has duration_minutes
        crosses_18: row.crosses_18 === 'TRUE' || row.crosses_18 === 'true', // Handle boolean string
        price_total_thb: row.price_total_thb ? parseFloat(row.price_total_thb) : null,
        status: row.status,
        hold_expires_at: row.hold_expires_at || null,
        created_at: row.created_at || new Date().toISOString(),
        updated_at: row.updated_at || new Date().toISOString(),
        confirmed_by: row.confirmed_by || null,
        cancelled_by: row.cancelled_by || null,
        cancel_reason: row.cancel_reason || null,
        paid_at: row.paid_at || null,
        version: row.version ? parseInt(row.version) : null,
        start_ts: row.start_ts || null,
        end_ts: row.end_ts || null,
        timeout_notified: row.timeout_notified === 'TRUE' || row.timeout_notified === 'true',
        notes: row.notes || null,
        admin_note: row.admin_note || null
    }));

    const { error } = await supabase.from('bookings').upsert(records, { onConflict: 'booking_id' });

    if (error) console.error('Error migrating bookings:', error);
    else console.log(`Successfully migrated ${records.length} bookings.`);
}

async function migrateUserStates() {
    console.log('Migrating User States...');
    const csvPath = path.join(GAS_DIR, 'TMG_Bookings - user_state.csv');
    if (!fs.existsSync(csvPath)) {
        console.error(`File not found: ${csvPath}`);
        return;
    }
    const csvContent = fs.readFileSync(csvPath, 'utf-8');

    const { data } = Papa.parse(csvContent, { header: true, skipEmptyLines: true });

    const records = data.map((row: any) => ({
        user_id: row.user_id,
        selected_date: row.date || null,
        selected_time: row.time_from || null,
        duration_h: row.duration_h ? parseFloat(row.duration_h) : null,
        field_no: row.field_no ? parseInt(row.field_no) : null,
        updated_at: row.updated_at || new Date().toISOString()
    }));

    const { error } = await supabase.from('user_states').upsert(records, { onConflict: 'user_id' });

    if (error) console.error('Error migrating user_states:', error);
    else console.log(`Successfully migrated ${records.length} user states.`);
}

async function migrateLogs() {
    console.log('Migrating Logs (this may take a while)...');
    const csvPath = path.join(GAS_DIR, 'TMG_Bookings - stat_log.csv');
    if (!fs.existsSync(csvPath)) {
        console.error(`File not found: ${csvPath}`);
        return;
    }
    const csvContent = fs.readFileSync(csvPath, 'utf-8');

    const { data } = Papa.parse(csvContent, { header: true, skipEmptyLines: true });

    // Batch insert logs to avoid payload limits
    const BATCH_SIZE = 100;
    const records = data.map((row: any) => {
        // Fix date format "19/12/2025, 12:45:07" -> ISO
        let ts = row.ts;
        if (ts && ts.includes('/')) {
            const [datePart, timePart] = ts.split(', ');
            const [day, month, year] = datePart.split('/');
            ts = `${year}-${month}-${day}T${timePart}+07:00`; // Assuming Thai time +07
        }

        return {
            timestamp: ts || null,
            user_id: row.user_id || null,
            source_type: row.source_type || null,
            event_type: row.event_type || null,
            action: row.action || null,
            step: row.step || null,
            label: row.label || null,
            message_text: row.message_text || null,
            postback_data: row.postback_data || null,
            process_ms: row.process_ms ? parseInt(row.process_ms) : null,
            extra_json: row.extra_json ? JSON.parse(row.extra_json) : null, // Be careful with JSON parsing
            date_int: row.date_int ? parseInt(row.date_int) : null
        };
    });

    for (let i = 0; i < records.length; i += BATCH_SIZE) {
        const batch = records.slice(i, i + BATCH_SIZE);
        const { error } = await supabase.from('logs').insert(batch);
        if (error) console.error(`Error migrating logs batch ${i}:`, error);
        else console.log(`Migrated logs batch ${i} - ${i + batch.length}`);
    }
    console.log(`Finished migrating ${records.length} logs.`);
}

async function run() {
    await migrateBookings();
    await migrateUserStates();
    await migrateLogs();
}

run();
