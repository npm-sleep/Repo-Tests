/**
 * Rida Module for ReadNovelFull.com
 *
 * Allows searching and reading web novels from ReadNovelFull.com.
 * Conforms to the Rida single-file module structure.
 * WARNING: Uses Regex for HTML parsing, which can break if the site updates.
 */
const readNovelFullModule = (fetch) => {
  const BASE_URL = 'https://readnovelfull.com'; // Consider using https://www.readwn.com/ as the site redirects

  // --- Helper Functions ---

  const extractAll = (html, regex) => {
    const matches = [];
    let match;
    if (!html) return matches; // Prevent error on null html
    while ((match = regex.exec(html)) !== null) {
      matches.push(match);
    }
    return matches;
  };

  const extractFirst = (html, regex) => {
    if (!html) return null; // Prevent error on null html
    const match = html.match(regex);
    return match ? match.slice(1) : null; // Return capture groups
  };

  const decodeEntities = (encodedString) => {
    if (!encodedString) return '';
    // Basic entities
    const translate_re = /&(nbsp|amp|quot|lt|gt|apos);/g; // Added apos
    const translate = {
      "nbsp": " ", "amp": "&", "quot": "\"", "lt": "<", "gt": ">", "apos": "'"
    };
    let decoded = encodedString.replace(translate_re, (match, entity) => translate[entity]);
    // Numerical entities
    decoded = decoded.replace(/&#(\d+);/gi, (match, numStr) => String.fromCharCode(parseInt(numStr, 10)));
     // Hex entities
    decoded = decoded.replace(/&#x([0-9A-Fa-f]+);/gi, (match, hexStr) => String.fromCharCode(parseInt(hexStr, 16)));
    return decoded;
  };

   const cleanHtmlText = (html) => {
     if (!html) return '';
     // Remove script/style blocks first
     let cleaned = html.replace(/<script[^>]*>.*?<\/script>/gis, '');
     cleaned = cleaned.replace(/<style[^>]*>.*?<\/style>/gis, '');
     // Replace <p> tags with double newlines for paragraph breaks
     cleaned = cleaned.replace(/<\/?p[^>]*>/gi, '\n\n');
     // Replace <br> tags with single newlines
     cleaned = cleaned.replace(/<br\s*\/?>/gi, '\n');
     // Remove remaining HTML tags
     cleaned = cleaned.replace(/<[^>]*>/g, '');
     // Decode entities and normalize whitespace
     return decodeEntities(cleaned).replace(/\n{3,}/g, '\n\n').trim(); // Collapse excess newlines
   };

  // --- Module Definition ---
  return {
    // --- Module Information (Matches the JSON structure) ---
    id: 'readnovelfull',
    name: 'ReadNovelFull',
    version: '1.0.1', // Keep version consistent or increment
    author: 'vizor (Adapted for Rida)',
    description: 'ReadNovelFull source for web novels (Rida compatible)',
    supportedLanguages: ['en'],
    isEnabled: true,
    baseURL: BASE_URL,

    // --- Required Methods ---

    /**
     * Search for novels.
     * @param {string} query - The search term.
     * @returns {Promise<Array<object>>} - Array of book results.
     */
    async search(query) {
      // The site redirects readnovelfull.com to www.readwn.com
      // Update BASE_URL or the specific URL here if needed
      const currentSiteUrl = 'https://www.readwn.com'; // Use the actual current domain
      const searchUrl = `${currentSiteUrl}/search/${encodeURIComponent(query.replace(/\s+/g, '-'))}`; // Search seems to use path now
      console.log(`ReadNovelFull Searching: ${searchUrl}`);

      try {
        // Need to handle potential redirects
        const response = await fetch(searchUrl, { redirect: 'follow' }); // Follow redirects

        if (!response.ok) {
          console.error(`Search failed: ${response.status} ${response.statusText} at ${response.url}`);
          return [];
        }
        const html = await response.text();
        const results = [];

        // Updated Regex for www.readwn.com search results structure (inspect the page source)
        // Example: <div class="novel-item"> ... <a href="/novel/novel-slug"> <img src="..." alt="..."> <h3>Title</h3> ... <p>description</p> ...
        const itemRegex = /<div class="novel-item[^"]*">\s*<a href="(\/novel\/[^"]+)"[^>]*>\s*<img[^>]*src="([^"]+)"[^>]*alt="([^"]+)"[^>]*>\s*<\/a>\s*<div class="novel-detail">\s*<h3><a[^>]*>([^<]+)<\/a><\/h3>.*?<p>(.*?)<\/p>/gis;

        const matches = extractAll(html, itemRegex);
        console.log(`Found ${matches.length} potential search results on ${response.url}.`);

        for (const match of matches) {
          const relativePath = match[1]; // e.g., /novel/martial-peak
          const id = relativePath.split('/').pop(); // Extract 'martial-peak' as the ID
          const coverUrl = match[2].startsWith('http') ? match[2] : currentSiteUrl + match[2];
          const title = decodeEntities(match[4].trim()); // Title from h3 content
          const description = cleanHtmlText(match[5]); // Clean the description HTML from <p>

          // Author is often not directly in search results, get later
          const author = '';

          if (id && title) {
            results.push({
              id: id, // Use the slug as ID
              title: title,
              author: author,
              coverUrl: coverUrl,
              description: description,
              // Store the relative path if needed for constructing URLs later
              _path: relativePath
            });
          }
        }

        console.log(`Parsed ${results.length} valid results.`);
        return results;

      } catch (error) {
        console.error('ReadNovelFull Search Error:', error);
        return [];
      }
    },

    /**
     * Get detailed information for a specific novel, including chapters.
     * @param {string} id - The novel ID (slug, e.g., martial-peak).
     * @returns {Promise<object>} - Detailed book information including chapters.
     */
    async getBookDetails(id) {
      const currentSiteUrl = 'https://www.readwn.com';
      const bookUrl = `${currentSiteUrl}/novel/${id}`; // Construct URL using the slug
      console.log(`Fetching details for: ${bookUrl}`);

      try {
        const response = await fetch(bookUrl);
        if (!response.ok) {
          throw new Error(`Failed to fetch book details: ${response.status} at ${bookUrl}`);
        }
        const html = await response.text();

        // --- Extract Details using Regex for www.readwn.com ---
        const titleMatch = extractFirst(html, /<h1 class="novel-title"[^>]*>([^<]+)<\/h1>/i);
        const title = titleMatch ? decodeEntities(titleMatch[0].trim()) : 'Unknown Title';

        // Author: Look for the structure around "Author:"
        const authorMatch = extractFirst(html, /<th scope="row">\s*Author\s*<\/th>\s*<td><a[^>]*>([^<]+)<\/a><\/td>/i);
        const author = authorMatch ? decodeEntities(authorMatch[0].trim()) : 'Unknown Author';

        const coverMatch = extractFirst(html, /<figure class="cover">\s*<img[^>]*src="([^"]+)"/i);
        const coverUrl = coverMatch ? (coverMatch[0].startsWith('http') ? coverMatch[0] : currentSiteUrl + coverMatch[0]) : 'https://via.placeholder.com/150x200?text=No+Cover';

        const descriptionMatch = extractFirst(html, /<div class="novel-summary"[^>]*>(.*?)<\/div>/is);
        const description = descriptionMatch ? cleanHtmlText(descriptionMatch[0]) : 'No description available.';

        // Genres: Find links within the genre list structure
        const genres = [];
        const genreListMatch = extractFirst(html, /<th scope="row">\s*Genre\s*<\/th>\s*<td>(.*?)<\/td>/is);
        if (genreListMatch) {
            const genreRegex = /<a[^>]*>([^<]+)<\/a>/gi;
            const genreMatches = extractAll(genreListMatch[0], genreRegex);
            genreMatches.forEach(match => genres.push(decodeEntities(match[1].trim())));
        }

         // Status: Look for the structure around "Status:"
         const statusMatch = extractFirst(html, /<th scope="row">\s*Status\s*<\/th>\s*<td>([^<]+)<\/td>/i);
         const status = statusMatch ? decodeEntities(statusMatch[0].trim()) : 'Unknown';

        // --- Extract Chapters (Chapters are usually listed directly now) ---
        const chapters = [];
        const chapterListHtmlMatch = extractFirst(html, /<ul class="chapter-list">(.*?)<\/ul>/is);
        if(chapterListHtmlMatch) {
            // Regex captures: 1=chapter path, 2=chapter title
            const chapterRegex = /<a href="(\/novel\/[^"]+)"[^>]*title="([^"]+)"/gi;
            const chapterMatches = extractAll(chapterListHtmlMatch[0], chapterRegex);
             for (const match of chapterMatches) {
                 const chapterPath = match[1]; // e.g. /novel/martial-peak/chapter-1
                 const chapterId = chapterPath.split('/').pop(); // Get 'chapter-1' as ID
                 const chapterTitle = decodeEntities(match[2].trim());
                 if (chapterId && chapterTitle) {
                     chapters.push({
                         id: chapterId, // Use chapter slug as ID
                         title: chapterTitle,
                         _path: chapterPath // Store full path for getContent if needed
                        });
                 }
             }
             // Chapters seem listed oldest first on this site. No reverse needed.
             console.log(`Parsed ${chapters.length} chapters from direct HTML.`);
        } else {
            console.warn("Could not find chapter list (ul.chapter-list) for:", id);
        }

        return {
          id: id, // Return the original slug ID
          title: title,
          author: author,
          coverUrl: coverUrl,
          description: description,
          genres: genres,
          status: status,
          chapters: chapters // Include the chapter list
        };

      } catch (error) {
        console.error(`Get Book Details Error for ID ${id}:`, error);
        throw new Error(`Failed to get details for ${id}: ${error.message}`);
      }
    },

    /**
     * Get content for a specific chapter.
     * @param {string} id - The chapter ID (slug, e.g., chapter-1). Needs the novel ID to construct URL.
     * @param {object} book - The full book details object (needed to get novel slug).
     * @returns {Promise<string>} - The cleaned text content of the chapter.
     */
    async getContent(id, book) {
      // We need the novel's slug (book.id) and the chapter slug (id)
      if (!book || !book.id) {
           throw new Error("Book details (including novel slug 'id') are required to fetch chapter content.");
       }
      const novelSlug = book.id;
      const chapterSlug = id;
      const currentSiteUrl = 'https://www.readwn.com';
      const chapterUrl = `${currentSiteUrl}/novel/${novelSlug}/${chapterSlug}`;
      console.log(`Fetching content for: ${chapterUrl}`);

      try {
        const response = await fetch(chapterUrl);
        if (!response.ok) {
          throw new Error(`Failed to fetch chapter content: ${response.status} for ${chapterUrl}`);
        }

        const html = await response.text();

        // Updated Regex for www.readwn.com chapter content
        const contentMatch = extractFirst(html, /<div id="chapter-container"[^>]*>(.*?)<\/div>/is);

        if (!contentMatch || !contentMatch[0]) {
          console.error("Could not find #chapter-container div for chapter:", chapterUrl);
          // Try fallback if site structure changed slightly
          const fallbackMatch = extractFirst(html, /<div class="chapter-content"[^>]*>(.*?)<\/div>/is);
           if (!fallbackMatch || !fallbackMatch[0]) {
                throw new Error('Chapter content container not found (#chapter-container or .chapter-content).');
           }
            console.log("Used fallback regex for chapter content.");
            var contentHtml = fallbackMatch[0];
        } else {
             var contentHtml = contentMatch[0];
        }


        // Clean the extracted HTML content
        const content = cleanHtmlText(contentHtml);

        if (!content) {
             console.warn("Extracted content is empty for chapter:", chapterUrl);
             throw new Error('Extracted chapter content is empty.');
        }

        return content; // Return the cleaned text string

      } catch (error) {
        console.error(`Get Content Error for Chapter ID ${id} (Novel ${novelSlug}):`, error);
        throw new Error(`Failed to get content for chapter ${id}: ${error.message}`);
      }
    }
  };
};

// Export the module function as the default export for Rida
export default readNovelFullModule;
