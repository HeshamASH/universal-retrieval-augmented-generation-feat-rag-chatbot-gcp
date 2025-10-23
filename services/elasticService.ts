import { ElasticResult, Source } from '../types';

declare const pdfjsLib: any;

// --- MOCK DATA FOR NEW CHATS ---

const getInitialCodebase = (): ElasticResult[] => [
  {
    source: { id: 'codebase-auth', fileName: 'auth.ts', path: 'src/lib/auth' },
    contentSnippet: `
import { NextApiRequest, NextApiResponse } from 'next';
import { IronSession, getIronSession } from 'iron-session';
import { SiweMessage, generateNonce } from 'siwe';

export const sessionOptions: IronSessionOptions = {
  password: process.env.SECRET_COOKIE_PASSWORD as string,
  cookieName: 'myapp-session',
  cookieOptions: {
    secure: process.env.NODE_ENV === 'production',
  },
};

export async function verifyLogin(req: NextApiRequest, res: NextApiResponse) {
  const session = await getIronSession(req, res, sessionOptions);
  const { message, signature } = req.body;
  const siweMessage = new SiweMessage(message);
  try {
    const fields = await siweMessage.verify({ signature });
    if (fields.data.nonce !== session.nonce) {
      return res.status(422).json({ message: 'Invalid nonce.' });
    }
    session.siwe = fields.data;
    await session.save();
    res.json({ ok: true });
  } catch (_error) {
    res.json({ ok: false });
  }
}
    `,
    score: 0.95
  },
  {
    source: { id: 'codebase-user-model', fileName: 'user.model.ts', path: 'src/models' },
    contentSnippet: `
import mongoose from 'mongoose';

const UserSchema = new mongoose.Schema({
  walletAddress: { type: String, required: true, unique: true },
  username: { type: String },
  createdAt: { type: Date, default: Date.now }
});

export default mongoose.models.User || mongoose.model('User', UserSchema);
    `,
    score: 0.88
  },
  {
    source: { id: 'codebase-api', fileName: 'api.ts', path: 'src/services' },
    contentSnippet: `
import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
});

export const fetchUserProfile = async (userId: string) => {
  const response = await api.get(\`/users/\${userId}\`);
  return response.data;
};

export const updateUserProfile = async (userId: string, data: any) => {
  const response = await api.put(\`/users/\${userId}\`, data);
  return response.data;
};
    `,
    score: 0.75
  },
];

const readPdfContent = async (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = async (e) => {
            if (!e.target?.result) {
                return reject(new Error("Failed to read file"));
            }
            try {
                const pdf = await pdfjsLib.getDocument(e.target.result).promise;
                let textContent = '';
                for (let i = 1; i <= pdf.numPages; i++) {
                    const page = await pdf.getPage(i);
                    const text = await page.getTextContent();
                    textContent += text.items.map((s: any) => s.str).join(' ');
                }
                resolve(textContent);
            } catch (error) {
                reject(error);
            }
        };
        reader.onerror = (error) => reject(error);
        reader.readAsArrayBuffer(file);
    });
};

export const createDatasetFromSources = (files: File[]): Promise<ElasticResult[]> => {
  return new Promise((resolve, reject) => {
    const results: ElasticResult[] = [];
    let filesToProcess = files.length;

    if (filesToProcess === 0) {
      resolve([]);
      return;
    }

    const processFile = (file: File) => {
        const fullPath = (file as any).webkitRelativePath || file.name;
        const lastSlash = fullPath.lastIndexOf('/');
        const path = lastSlash === -1 ? '' : fullPath.substring(0, lastSlash);
        const fileName = lastSlash === -1 ? fullPath : fullPath.substring(lastSlash + 1);

        const onContentReady = (content: string) => {
             results.push({
                source: {
                    id: `custom-${fullPath}-${file.size}-${file.lastModified}`,
                    fileName: fileName,
                    path: path,
                },
                contentSnippet: content,
                score: 1.0,
            });
            filesToProcess--;
            if (filesToProcess === 0) {
                resolve(results);
            }
        };
        
        const onError = (error: any) => {
            console.error("Error reading file:", file.name, error);
            filesToProcess--;
            if (filesToProcess === 0) {
                resolve(results); // Resolve with what we have
            }
        };

        if (file.type === 'application/pdf') {
            readPdfContent(file).then(onContentReady).catch(onError);
        } else if (file.type.startsWith('text/') || file.type === 'application/json' || file.name.endsWith('.md') || !file.type) {
            const reader = new FileReader();
            reader.onload = (e) => onContentReady(e.target?.result as string);
            reader.onerror = onError;
            reader.readAsText(file);
        } else {
            console.warn(`Skipping non-text/non-pdf file: ${file.name} (${file.type})`);
            filesToProcess--;
            if (filesToProcess === 0) {
                resolve(results);
            }
        }
    };

    files.forEach(processFile);
  });
};


export const searchDocuments = (query: string, dataset: ElasticResult[]): Promise<ElasticResult[]> => {
  console.log(`[Elastic Mock] Searching for: "${query}"`);

  return new Promise(resolve => {
    setTimeout(() => {
      const lowerCaseQuery = query.toLowerCase();
      const keywords = lowerCaseQuery.split(' ').filter(word => word.length > 2);

      const results = dataset.filter(doc => {
        const content = (doc.source.fileName + ' ' + doc.contentSnippet).toLowerCase();
        return keywords.some(keyword => content.includes(keyword));
      });

      console.log(`[Elastic Mock] Found ${results.length} results.`);
      resolve(results.slice(0, 5)); // Return top 5 results
    }, 500);
  });
};

export const getFileContent = (source: Source, dataset: ElasticResult[]): Promise<string | null> => {
    console.log(`[Elastic Mock] Fetching content for: "${source.fileName}" (id: ${source.id})`);
    return new Promise(resolve => {
        setTimeout(() => {
            const doc = dataset.find(d => d.source.id === source.id);
            resolve(doc ? doc.contentSnippet.trim() : null);
        }, 100);
    });
};

export const getAllFiles = (dataset: ElasticResult[]): Promise<Source[]> => {
  console.log(`[Elastic Mock] Fetching all files from current dataset.`);

  return new Promise(resolve => {
    setTimeout(() => {
      const uniqueFiles = new Map<string, Source>();
      dataset.forEach(doc => {
        if (!uniqueFiles.has(doc.source.id)) {
          uniqueFiles.set(doc.source.id, doc.source);
        }
      });
      const allFiles = Array.from(uniqueFiles.values());
      console.log(`[Elastic Mock] Found ${allFiles.length} unique files.`);
      resolve(allFiles);
    }, 200);
  });
};

export const updateFileContent = (source: Source, newContent: string, dataset: ElasticResult[]): Promise<{success: boolean, newDataset: ElasticResult[]}> => {
    console.log(`[Elastic Mock] Updating content for: "${source.fileName}" (id: ${source.id})`);
    return new Promise(resolve => {
        let found = false;
        const newDataset = dataset.map(doc => {
            if (doc.source.id === source.id) {
                found = true;
                return { ...doc, contentSnippet: newContent };
            }
            return doc;
        });

        if (found) {
             console.log(`[Elastic Mock] Updated ${source.fileName} successfully.`);
             resolve({ success: true, newDataset });
        } else {
            console.error(`[Elastic Mock] Could not find file to update with id: ${source.id}`);
            resolve({ success: false, newDataset: dataset });
        }
    });
};