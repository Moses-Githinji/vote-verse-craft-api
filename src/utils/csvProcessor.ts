import Papa from 'papaparse';
import { Voter } from '../models/Voter';

export const processVoterCSV = async (buffer: Buffer, organizationId: string) => {
  return new Promise((resolve, reject) => {
    Papa.parse(buffer.toString(), {
      header: true,
      skipEmptyLines: true,
      transformHeader: (header) => header.toLowerCase().trim(),
      complete: async (results) => {
        const { data, errors } = results;

        if (errors.length > 0) {
          return reject(new Error(`CSV parsing errors: ${errors.map(e => e.message).join(', ')}`));
        }

        const processedVoters: any[] = [];
        const validationErrors: string[] = [];

        for (let i = 0; i < data.length; i++) {
          const row = data[i] as any;

          try {
            const name = row.name?.trim();
            const authCredential = row.admission_number?.trim() || row.authcredential?.trim();

            if (!name || !authCredential) {
              validationErrors.push(`Row ${i + 2}: Missing required fields (name, admission_number)`);
              continue;
            }

            const duplicateInFile = processedVoters.some(v => v.authCredential === authCredential);
            if (duplicateInFile) {
              validationErrors.push(`Row ${i + 2}: Duplicate admission number ${authCredential} in file`);
              continue;
            }

            const existingVoter = await Voter.findOne({
              organizationId,
              authCredential
            });

            if (existingVoter) {
              validationErrors.push(`Row ${i + 2}: Voter with admission number ${authCredential} already exists`);
              continue;
            }

            processedVoters.push({
              name,
              authCredential,
              stream: row.stream?.trim() || null,
              email: row.email?.trim() || null,
              phone: row.phone?.trim() || null,
              organizationId
            });

          } catch (error: any) {
            validationErrors.push(`Row ${i + 2}: ${error.message}`);
          }
        }

        resolve({
          validVoters: processedVoters,
          errors: validationErrors,
          totalRows: data.length,
          validRows: processedVoters.length,
          errorRows: validationErrors.length
        });
      },
      error: (error: any) => {
        reject(new Error(`CSV parsing failed: ${error.message}`));
      }
    });
  });
};
