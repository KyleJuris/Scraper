import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import { ScraperService } from './scraper.js';
import { DatabaseService, supabase } from './lib/supabase.js';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Basic health check route
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    message: 'URL Scraper Backend is running',
    timestamp: new Date().toISOString()
  });
});

// API routes placeholder
app.get('/api', (req, res) => {
  res.json({ 
    message: 'URL Scraper API',
    version: '1.0.0',
    endpoints: {
      health: '/health',
      scrape: '/api/scrape (POST)',
      urls: '/api/urls (GET)',
      jobs: '/api/jobs (GET)',
      results: '/api/results (GET)'
    }
  });
});

// Start scraping endpoint
app.post('/api/scrape', async (req, res) => {
  try {
    console.log('🚀 Starting scraper via API...');
    const scraper = new ScraperService();
    
    // Run scraper in background
    scraper.runScrape()
      .then(() => {
        console.log('✅ Scraper completed successfully');
      })
      .catch((error) => {
        console.error('❌ Scraper failed:', error);
      });

    res.json({ 
      message: 'Scraper started successfully',
      status: 'running'
    });
  } catch (error) {
    console.error('Error starting scraper:', error);
    res.status(500).json({ 
      error: 'Failed to start scraper',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Get unchecked URLs
app.get('/api/urls', async (req, res) => {
  try {
    const urls = await DatabaseService.getUncheckedUrls();
    res.json({ 
      urls,
      count: urls.length
    });
  } catch (error) {
    console.error('Error fetching URLs:', error);
    res.status(500).json({ 
      error: 'Failed to fetch URLs',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Get recent scrape jobs
app.get('/api/jobs', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('scrape_jobs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(10);

    if (error) throw error;

    res.json({ 
      jobs: data || []
    });
  } catch (error) {
    console.error('Error fetching jobs:', error);
    res.status(500).json({ 
      error: 'Failed to fetch jobs',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Get recent scrape results
app.get('/api/results', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('scrape_results')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) throw error;

    res.json({ 
      results: data || []
    });
  } catch (error) {
    console.error('Error fetching results:', error);
    res.status(500).json({ 
      error: 'Failed to fetch results',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Error handling middleware
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error(err.stack);
  res.status(500).json({ 
    error: 'Something went wrong!',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error'
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ 
    error: 'Route not found',
    path: req.originalUrl
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 URL Scraper Backend running on port ${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/health`);
  console.log(`🔗 API info: http://localhost:${PORT}/api`);
});

export default app;
