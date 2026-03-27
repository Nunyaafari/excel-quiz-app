const path = require('path')

/** @type {import('next').NextConfig} */
const nextConfig = {
  outputFileTracingRoot: path.join(__dirname),
  images: {
    domains: ['lh3.googleusercontent.com'],
  },
}

module.exports = nextConfig
