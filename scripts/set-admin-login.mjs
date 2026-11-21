// Input is supplied through stdin. Never prints the plaintext password or hash.
import {passwordHash} from '../lib/licensing.mjs';
import fs from 'node:fs/promises';
let input='';for await(const chunk of process.stdin)input+=chunk;
const {email,password,outputDirectory}=JSON.parse(input);
if(!email||typeof password!=='string'||password.length<12||!outputDirectory)throw new Error('Email, a 12+ character password and private output directory required');
const hash=await passwordHash(password);
await fs.writeFile(outputDirectory+'/admin-password-hash.txt',hash);
await fs.writeFile(outputDirectory+'/admin-email.txt',email.trim().toLowerCase());
await fs.writeFile(outputDirectory+'/admin-login.json',JSON.stringify({email:email.trim().toLowerCase(),password},null,2));
console.log('Private login configuration and salted hash prepared.');
