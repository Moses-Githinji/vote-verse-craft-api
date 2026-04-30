import puppeteer from 'puppeteer-core';
import path from 'path';

/**
 * PDFService provides functionality to convert HTML content into PDF documents
 * using a headless browser (Microsoft Edge).
 */
export class PDFService {
  // Common path for Microsoft Edge on Windows
  private static readonly EDGE_PATH = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';

  /**
   * Generates a PDF Buffer from HTML content.
   * 
   * @param html HTML content to render (should include inlined CSS)
   */
  static async generatePDF(html: string): Promise<Buffer> {
    let browser;
    try {
      browser = await puppeteer.launch({
        executablePath: this.EDGE_PATH,
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      });

      const page = await browser.newPage();
      
      // Set content and wait for DOM to be ready (faster than networkidle0)
      await page.setContent(html, { 
        waitUntil: 'domcontentloaded',
        timeout: 60000 // Increase timeout to 60s for safety
      });

      // Generate PDF
      const pdfBuffer = await page.pdf({
        format: 'A4',
        printBackground: true,
        margin: {
          top: '20px',
          right: '20px',
          bottom: '20px',
          left: '20px'
        }
      });

      return Buffer.from(pdfBuffer);
    } catch (error: any) {
      console.error('[PDF] Generation failed:', error.message);
      throw new Error(`Failed to generate PDF: ${error.message}`);
    } finally {
      if (browser) {
        await browser.close();
      }
    }
  }
}
