/**
 * Rida Module for MangaPill.com
 *
 * Allows searching and reading manga from MangaPill.
 * Conforms to the Rida single-file module structure.
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
    if (!encodedString) return '';
    const translate_re = /&(nbsp|amp|quot|lt|gt);/g;
    const translate = {
        "nbsp": " ", "amp" : "&", "quot": "\"", "lt"  : "<", "gt"  : ">"
    };
    let decoded = encodedString.replace(translate_re, (match, entity) => translate[entity]);
     // Numerical entities
    decoded = decoded.replace(/&#(\d+);/gi, (match, numStr) => String.fromCharCode(parseInt(numStr, 10)));
     // Hex entities
    decoded = decoded.replace(/&#x([0-9A-Fa-f]+);/gi, (match, hexStr) => String.fromCharCode(parseInt(hexStr, 16)));
    return decoded;
  }

  // --- Module Definition ---
  return {
    // --- Module Information ---
    id: 'mangapill', // Corresponds to JSON 'id'
    name: 'MangaPill', // Corresponds to JSON 'name'
    version: '1.0.1', // Corresponds to JSON 'version'
    author: 'AI Assistant (Adapted for Rida)', // Corresponds to JSON 'author'
    description: 'Search and read manga from MangaPill.com.', // Corresponds to JSON 'description'
    supportedLanguages: ['en'], // Corresponds to JSON 'supportedLanguages'
    isEnabled: true,          // Corresponds to JSON 'isEnabled'
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
        // Captures: 1=manga path, 2=image URL, 3=title (from img alt), 4=title (from div)
        const itemRegex = /<a href="(\/manga\/[^"]+)"[^>]*>\s*<img[^>]+data-src="([^"]+)"[^>]*alt="([^"]+)"[^>]*>\s*<\/a>\s*<div class="mt-3 font-bold[^"]*">([^<]+)<\/div>/gi;


        const matches = extractAll(html, itemRegex);
        console.log(`Found ${matches.length} potential search results.`);


        for (const match of matches) {
          // Basic check if the structure looks like a valid manga item link
           if (match[1] && match[1].startsWith('/manga/')) {
                const id = match[1]; // e.g., /manga/1/one-piece
                const coverUrl = match[2]; // Usually absolute URL in data-src
                const title = decodeEntities(match[4].trim()); // Title from the div below image more reliable

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
        const coverMatch = extractFirst(html, /<img[^>]+class="[^"]*mb-3[^"]*"[^>]*data-src="([^"]+)"/i)
                       ?? extractFirst(html, /<div class="flex flex-col sm:flex-row my-3">\s*<div>\s*<img[^>]+data-src="([^"]+)"/i);
        const coverUrl = coverMatch ? coverMatch[0] : '';

        // Description (often in a <p> tag with specific classes)
        const descriptionMatch = extractFirst(html, /<p class="text-sm[^"]*">\s*([^<]+(?:\s+[^<]+)*)\s*<\/p>/i); // Allow spaces
        const description = descriptionMatch ? decodeEntities(descriptionMatch[0].trim()) : 'No description available.';

        // Author (Attempt to find it)
         const authorMatch = extractFirst(html, /<div>Author\(s\)<\/div>\s*<div[^>]*>([^<]+)<\/div>/i)
                         ?? extractFirst(html, /<div>Author<\/div>\s*<div[^>]*>([^<]+)<\/div>/i);
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
                });
            }
            chapters.reverse(); // Reverse for reading order
        }


        return {
          id: id, // Return the original ID
          title: title,
          author: author,
          coverUrl: coverUrl,
          description: description,
          genres: genres,
          status: status,
          type: type,
          chapters: chapters
        };

      } catch (error) {
        console.error(`Get Book Details Error for ID ${id}:`, error);
        throw new Error(`Failed to get details for ${id}: ${error.message}`);
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
             headers: { 'Referer': baseURL + '/' }
        });

        if (!response.ok) {
          throw new Error(`Failed to fetch chapter content: ${response.status}`);
        }

        const html = await response.text();
        const pages = [];

        // Regex to find page image URLs within <chapter-page> -> <picture> -> <img data-src>
        const pageRegex = /<chapter-page[^>]*>\s*<picture(?:[^>]*\s*>\s*<source[^>]*>)*[^>]*\s*<img[^>]+data-src="([^"]+)"/gi;

        const matches = extractAll(html, pageRegex);
         console.log(`Found ${matches.length} potential page images.`);


        for (const match of matches) {
             if (match[1] && match[1].includes('mangapill')) { // Basic validation
                pages.push(match[1]);
            }
        }

         if (pages.length === 0) {
             console.warn("No pages extracted using primary regex, trying fallback pattern for chapter:", id);
             // Fallback: Look for any data-src image that looks like a chapter page
             const fallbackPageRegex = /<img[^>]+data-src="([^"]+)"/gi;
             const fallbackMatches = extractAll(html, fallbackPageRegex);
             console.log(`Fallback found ${fallbackMatches.length} potential images.`);
             for (const match of fallbackMatches) {
                 if (match[1] && match[1].includes('mangapill') && /\/chapters\/\d+/.test(match[1])) { // Stricter fallback check
                     pages.push(match[1]);
                 }
             }
         }

        if (pages.length === 0) {
          console.error("Could not extract any page image URLs for chapter:", id);
           throw new Error('No page images found for this chapter.');
        }

        console.log(`Extracted ${pages.length} pages for chapter ${id}`);
        return pages; // Return array of image URLs

      } catch (error) {
        console.error(`Get Content Error for ID ${id}:`, error);
        throw new Error(`Failed to get content for ${id}: ${error.message}`);
      }
    }
  };
};

// Export the module function as the default export for Rida
export default mangapillModule;
