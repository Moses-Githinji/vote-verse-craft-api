import { PDFService } from './PDFService';
import fs from 'fs';
import path from 'path';
import juice from 'juice';

export class InvoiceService {
  /**
   * Generates a PDF buffer from a template and variables
   */
  static async generateInvoicePDF(variables: Record<string, any>): Promise<Buffer> {
    const templatePath = path.join(__dirname, '../emails/invoice_ready.html');
    
    if (!fs.existsSync(templatePath)) {
      throw new Error(`Invoice template not found: ${templatePath}`);
    }

    let html = fs.readFileSync(templatePath, 'utf-8');

    // Replace placeholders
    for (const [key, value] of Object.entries(variables)) {
      const regex = new RegExp(`{{${key}}}`, 'g');
      html = html.replace(regex, String(value ?? '—'));
    }

    const inlinedHtml = juice(html);
    return await PDFService.generatePDF(inlinedHtml);
  }

  /**
   * Returns a publicly accessible URL to download the invoice PDF from our own server
   */
  static async getInvoiceUrl(booking: any): Promise<string> {
    const baseUrl = process.env.API_BASE_URL || 'http://localhost:4000';
    return `${baseUrl}/api/v1/public/booking/${booking._id}/invoice/pdf`;
  }
}
