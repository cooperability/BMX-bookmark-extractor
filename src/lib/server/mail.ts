import nodemailer from 'nodemailer';
import { dev } from '$app/environment';
import { env } from '$env/dynamic/private';

export async function sendLoginCode(to: string, code: string): Promise<void> {
	if (!env.GMAIL_USER || !env.GMAIL_APP_PASSWORD) {
		// Local runs without Gmail credentials still need a way in.
		if (dev) {
			console.log(`[auth] login code for ${to}: ${code}`);
			return;
		}
		throw new Error('GMAIL_USER and GMAIL_APP_PASSWORD must be set');
	}
	const transport = nodemailer.createTransport({
		service: 'gmail',
		auth: { user: env.GMAIL_USER, pass: env.GMAIL_APP_PASSWORD }
	});
	await transport.sendMail({
		from: env.GMAIL_USER,
		to,
		subject: `Remediate login code: ${code}`,
		text: `Your Remediate login code is ${code}. It expires in 10 minutes.`
	});
}
