/**
 * Rida Module for MangaPill.com
 *
 * Allows searching and reading manga from MangaPill.
 */
const mangapillModule = (fetch) => {
  const baseURL = 'https://mangapill.com';

  // --- Helper Function for Basic HTML Parsing ---
  // CAUTION: Regex on HTML is brittle!
  const extractAll = (html, regex) => {
    const matches = [];
    let match;
    while ((match = regex.exec(html)) !== null) {
      matches.push(match);
    }
    return matches;
  };

  const extractFirst = (html, regex) => {
      const match = html.match(regex);
      return match ? match.slice(1) : null; // Return capture groups
  };

   // Simple HTML entity decoder
   const decodeEntities = (encodedString) => {
    const translate_re = /&(nbsp|amp|quot|lt|gt);/g;
    const translate = {
        "nbsp": " ",
        "amp" : "&",
        "quot": "\"",
        "lt"  : "<",
        "gt"  : ">"
    };
    return encodedString.replace(translate_re, function(match, entity) {
        return translate[entity];
    }).replace(/&#(\d+);/gi, function(match, numStr) {
        const num = parseInt(numStr, 10);
        return String.fromCharCode(num);
    });
  }

  // --- Module Definition ---
  return {
    // --- Module Information ---
    id: 'mangapill',
    name: 'MangaPill',
    version: '1.0.1', // Start with 1.0.0, increment as needed
    author: 'AI Assistant (Adapted for Rida)', // Or your name/handle
    description: 'Search and read manga from MangaPill.com.',
    supportedLanguages: ['en'],
    isEnabled: true,
    baseURL: baseURL, // Expose baseURL for potential external use/debugging

    // --- Required Methods ---

    /**
     * Search for manga.
     * @param {string} query - The search term.
     * @returns {Promise<Array<object>>} - Array of book results.
     */
    async search(query) {
      const searchURL = `${baseURL}/search?q=${encodeURIComponent(query)}`;
      console.log(`Searching MangaPill: ${searchURL}`);

      try {
        const response = await fetch(searchURL, {
            method: 'GET',
            headers: { 'Referer': baseURL + '/' } // Add Referer
        });

        if (!response.ok) {
          console.error(`Search failed: ${response.status} ${response.statusText}`);
          return [];
        }

        const html = await response.text();
        const results = [];

        // Regex to find search result blocks (adjust if structure changes)
        // Captures: 1=manga path, 2=image URL, 3=title
        const itemRegex = /<a href="(\/manga\/[^"]+)"[^>]*>\s*<img[^>]+data-src="([^"]+)"[^>]*alt="([^"]+)"[^>]*>\s*<\/a>\s*<div class="mt-3 font-bold[^"]*">([^<]+)<\/div>/gi;

        const matches = extractAll(html, itemRegex);
        console.log(`Found ${matches.length} potential search results.`);


        for (const match of matches) {
          // Basic check if the structure looks like a valid manga item link
           if (match[1] && match[1].startsWith('/manga/')) {
                const id = match[1]; // e.g., /manga/1/one-piece
                const coverUrl = match[2]; // Usually absolute URL in data-src
                const title = decodeEntities(match[4].trim()); // Title from the div below image

                // Description and Author are not directly available on search page
                const description = ''; // Get full description in getBookDetails
                const author = ''; // Try to get in getBookDetails

                results.push({
                  id: id,
                  title: title,
                  author: author,
                  coverUrl: coverUrl,
                  description: description,
                });
            }
        }

        console.log(`Parsed ${results.length} valid results.`);
        return results;

      } catch (error) {
        console.error('MangaPill Search Error:', error);
        return []; // Return empty array on error as per Rida guide
      }
    },

    /**
     * Get detailed information for a specific manga.
     * @param {string} id - The manga ID (path, e.g., /manga/1/one-piece).
     * @returns {Promise<object>} - Detailed book information including chapters.
     */
    async getBookDetails(id) {
      const bookURL = baseURL + id;
      console.log(`Fetching details for: ${bookURL}`);

      try {
        const response = await fetch(bookURL, {
             method: 'GET',
             headers: { 'Referer': baseURL + '/' }
        });

        if (!response.ok) {
          throw new Error(`Failed to fetch book details: ${response.status}`);
        }

        const html = await response.text();

        // --- Extract Details using Regex ---

        // Title (from h1)
        const titleMatch = extractFirst(html, /<h1[^>]*>([^<]+)<\/h1>/i);
        const title = titleMatch ? decodeEntities(titleMatch[0].trim()) : 'Unknown Title';

        // Cover URL (from img with data-src inside the main container)
        // Look for an image likely the main cover, often has mb-3 class or similar context
        const coverMatch = extractFirst(html, /<img[^>]+class="[^"]*mb-3[^"]*"[^>]*data-src="([^"]+)"/i)
                       ?? extractFirst(html, /<div class="flex flex-col sm:flex-row my-3">\s*<div>\s*<img[^>]+data-src="([^"]+)"/i); // Alternative pattern
        const coverUrl = coverMatch ? coverMatch[0] : '';

        // Description (often in a <p> tag with specific classes)
        const descriptionMatch = extractFirst(html, /<p class="text-sm[^"]*">\s*([^<]+)\s*<\/p>/i);
        const description = descriptionMatch ? decodeEntities(descriptionMatch[0].trim()) : 'No description available.';

        // Author (Attempt to find it - MangaPill structure varies)
         const authorMatch = extractFirst(html, /<div>Author\(s\)<\/div>\s*<div[^>]*>([^<]+)<\/div>/i)
                         ?? extractFirst(html, /<div>Author<\/div>\s*<div[^>]*>([^<]+)<\/div>/i); // Try singular too
        const author = authorMatch ? decodeEntities(authorMatch[0].trim()) : 'N/A';

        // Status
        const statusMatch = extractFirst(html, /<div>Status<\/div>\s*<div[^>]*>([^<]+)<\/div>/i);
        const status = statusMatch ? decodeEntities(statusMatch[0].trim()) : 'N/A';

        // Type (e.g., Manga, Manhwa)
        const typeMatch = extractFirst(html, /<div>Type<\/div>\s*<div[^>]*>([^<]+)<\/div>/i);
        const type = typeMatch ? decodeEntities(typeMatch[0].trim()) : 'N/A';


        // Genres (find all genre links)
        const genreRegex = /<a[^>]+href="\/search\?genre=[^"]+"[^>]*>([^<]+)<\/a>/gi;
        const genreMatches = extractAll(html, genreRegex);
        const genres = genreMatches.map(match => decodeEntities(match[1].trim()));

        // Chapters (find all chapter links in the #chapters div)
        const chapters = [];
        const chapterListHtmlMatch = html.match(/<div id="chapters"[^>]*>(.*?)<\/div>/is);
        if(chapterListHtmlMatch && chapterListHtmlMatch[1]) {
            const chapterListHtml = chapterListHtmlMatch[1];
            // Regex captures: 1=chapter path, 2=chapter title
             const chapterRegex = /<a href="(\/chapters\/[^"]+)"[^>]*>\s*([^<]+)\s*<\/a>/gi;
             const chapterMatches = extractAll(chapterListHtml, chapterRegex);

             for (const match of chapterMatches) {
                const chapterId = match[1]; // e.g., /chapters/1-1000000/one-piece-chapter-0
                const chapterTitle = decodeEntities(match[2].trim());
                chapters.push({
                    id: chapterId,        // Use chapter path as ID for getContent
                    title: chapterTitle,
                    // Add other fields if needed/available (e.g., date)
                });
            }
            chapters.reverse(); // Typically chapters are listed newest first, reverse for reading order
        }


        return {
          id: id, // Return the original ID
          title: title,
          author: author,
          coverUrl: coverUrl,
          description: description,
          genres: genres,    // Add genres array
          status: status,    // Add status
          type: type,        // Add type
          chapters: chapters // Add chapters array
        };

      } catch (error) {
        console.error(`Get Book Details Error for ID ${id}:`, error);
        throw new Error(`Failed to get details for ${id}: ${error.message}`); // Throw error as per Rida guide
      }
    },

    /**
     * Get content for a specific chapter (list of image URLs).
     * @param {string} id - The chapter ID (path, e.g., /chapters/1-1000000/one-piece-chapter-0).
     * @returns {Promise<Array<string>>} - Array of image URLs for the chapter pages.
     */
    async getContent(id) {
      const chapterURL = baseURL + id;
      console.log(`Fetching content for: ${chapterURL}`);

      try {
        const response = await fetch(chapterURL, {
             method: 'GET',
             headers: { 'Referer': baseURL + '/' } // Referer might be important for images
        });

        if (!response.ok) {
          throw new Error(`Failed to fetch chapter content: ${response.status}`);
        }

        const html = await response.text();
        const pages = [];

        // Regex to find page image URLs within <chapter-page> or similar structure
        // MangaPill uses <picture><img data-src="..."></picture> inside elements for each page
        const pageRegex = /<chapter-page[^>]*>\s*<picture>\s*<source[^>]*>\s*<img[^>]+data-src="([^"]+)"/gi;
        // Simpler fallback if the above is too specific:
        // const pageRegex = /<img[^>]+data-src="([^"]+)"[^>]*>/gi; // Less specific, might grab other images

        const matches = extractAll(html, pageRegex);
         console.log(`Found ${matches.length} potential page images.`);


        for (const match of matches) {
            // Simple check if URL looks like an image from their CDN
             if (match[1] && match[1].includes('mangapill')) {
                pages.push(match[1]);
            }
        }

         if (pages.length === 0) {
             console.warn("No pages extracted using primary regex, trying fallback pattern for chapter:", id);
             // Try a broader regex if the specific one failed
             const fallbackPageRegex = /<img[^>]+data-src="([^"]+)"[^>]*>/gi;
             const fallbackMatches = extractAll(html, fallbackPageRegex);
             console.log(`Fallback found ${fallbackMatches.length} potential images.`);
             for (const match of fallbackMatches) {
                 // Filter more carefully for likely page images
                 if (match[1] && match[1].includes('mangapill') && match[1].includes('/chapters/')) {
                     pages.push(match[1]);
                 }
             }
         }

        if (pages.length === 0) {
          console.error("Could not extract any page image URLs for chapter:", id);
          // Decide: return empty array or throw error?
          // Let's throw, as an empty chapter is usually an error state.
           throw new Error('No page images found for this chapter.');
        }

        console.log(`Extracted ${pages.length} pages for chapter ${id}`);
        return pages; // Return array of image URLs

      } catch (error) {
        console.error(`Get Content Error for ID ${id}:`, error);
        throw new Error(`Failed to get content for ${id}: ${error.message}`); // Throw error as per Rida guide
      }
    }
  };
};

// If running in an environment that supports `export default` (like Rida likely does)
export default mangapillModule;
// Otherwise, for environments like Node.js testing, you might use:
// module.exports = mangapillModule;
