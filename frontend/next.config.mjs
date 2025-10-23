/** @type {import('next').NextConfig} */
import CopyPlugin from 'copy-webpack-plugin';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const nextConfig = {
  reactStrictMode: true,
  webpack: (config, { isServer }) => {
     if (!isServer) {
         config.plugins.push(
             new CopyPlugin({
                 patterns: [
                     {
                         from: path.join(
                             path.dirname(require.resolve('pdfjs-dist/package.json')),
                             'build/pdf.worker.min.mjs'
                         ),
                         to: path.join(__dirname, 'public/static/scripts'),
                     },
                 ],
             })
         );
     }
    return config;
  },
};

export default nextConfig;