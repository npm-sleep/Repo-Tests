/**
 * Rida Module for ReadNovelFull.com
 *
 * Allows searching and reading web novels from ReadNovelFull.com.
 * WARNING: Uses Regex for HTML parsing, which can break if the site updates.
 */
const readNovelFullModule = (fetch) => {
  const BASE_URL = 'https://readnovelfull.com';

  // --- Helper Functions ---

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

  const decodeEntities = (encodedString) => {
    if (!encodedString) return '';
    // Basic entities
    const translate_re = /&(nbsp|amp|quot|lt|gt);/g;
    const translate = {
      "nbsp": " ", "amp": "&", "quot": "\"", "lt": "<", "gt": ">"
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
     return decodeEntities(html.replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]*>/g, '').trim());
   };

  // --- Module Definition ---
  return {
    // --- Module Information (from your JSON) ---
    id: 'readnovelfull',
    name: 'ReadNovelFull',
    version: '1.0.1', // Incremented version due to rewrite
    author: 'vizor (Adapted for Rida)',
    description: 'ReadNovelFull source for web novels (Rida compatible)',
    supportedLanguages: ['en'],
    isEnabled: true,
    baseURL: BASE_URL, // Include for reference

    // --- Required Methods ---

    /**
     * Search for novels.
     * @param {string} query - The search term.
     * @returns {Promise<Array<object>>} - Array of book results.
     */
    async search(query) {
      const searchUrl = `${BASE_URL}/novel-list/search?keyword=${encodeURIComponent(query)}`;
      console.log(`ReadNovelFull Searching: ${searchUrl}`);

      try {
        const response = await fetch(searchUrl);
        if (!response.ok) {
          console.error(`Search failed: ${response.status} ${response.statusText}`);
          return [];
        }
        const html = await response.text();
        const results = [];

        // Regex to find search result blocks (.row within #list-page .list-novel)
        // Captures: 1=novel slug (id), 2=coverUrl, 3=title, 4=author, 5=description HTML
        const itemRegex = /<div class="row"[^>]*>\s*<div class="col-xs-3[^"]*">\s*<a href="\/([^"]+)"[^>]*>\s*<img[^>]*src="([^"]+)"[^>]*alt="([^"]+)"/gis;
        // Secondary regex might be needed if layout differs or to grab author/desc separately
        // This simpler regex focuses on getting the core link, image, and alt-text as title initially
        // Let's try a more comprehensive one (might be less reliable):
        const comprehensiveItemRegex = /<div class="col-xs-3.*?<a href="\/([^"]+)"[^>]*>\s*<img[^>]*src="([^"]+)"[^>]*>.*?<h3 class="novel-title"[^>]*><a[^>]*>([^<]+)<\/a><\/h3>.*?<span class="author"[^>]*>([^<]+)<\/span>.*?<div class="novel-desc">(.*?)<\/div>/gis;

        const matches = extractAll(html, comprehensiveItemRegex);
        console.log(`Found ${matches.length} potential search results.`);

        for (const match of matches) {
          const id = match[1]; // e.g., martial-peak
          const coverUrl = match[2].startsWith('http') ? match[2] : BASE_URL + match[2]; // Make URL absolute if needed
          const title = decodeEntities(match[3].trim());
          const author = decodeEntities(match[4].trim());
          const description = cleanHtmlText(match[5]); // Clean the description HTML

          if (id && title) {
            results.push({
              id: id,
              title: title,
              author: author || 'Unknown Author',
              coverUrl: coverUrl || 'https://via.placeholder.com/150x200?text=No+Cover',
              description: description || 'No description available.',
            });
          }
        }

        console.log(`Parsed ${results.length} valid results.`);
        return results;

      } catch (error) {
        console.error('ReadNovelFull Search Error:', error);
        return []; // Return empty array on error
      }
    },

    /**
     * Get detailed information for a specific novel, including chapters.
     * @param {string} id - The novel ID (slug, e.g., martial-peak).
     * @returns {Promise<object>} - Detailed book information including chapters.
     */
    async getBookDetails(id) {
      const bookUrl = `${BASE_URL}/${id}.html`; // URLs often end with .html
      console.log(`Fetching details for: ${bookUrl}`);

      try {
        const response = await fetch(bookUrl);
        if (!response.ok) {
            // Try without .html if the first attempt failed
            const fallbackUrl = `${BASE_URL}/${id}`;
             console.log(`Retrying details fetch without .html: ${fallbackUrl}`);
             response = await fetch(fallbackUrl);
             if (!response.ok) {
                 throw new Error(`Failed to fetch book details (tried with and without .html): ${response.status}`);
            }
        }

        const html = await response.text();

        // --- Extract Details using Regex ---
        const titleMatch = extractFirst(html, /<h3 class="title"[^>]*>([^<]+)<\/h3>/i);
        const title = titleMatch ? decodeEntities(titleMatch[0].trim()) : 'Unknown Title';

        // Author: Look for the structure around "Author(s):"
        const authorMatch = extractFirst(html, />\s*Author\(s\):\s*<\/label>\s*<ul[^>]*>\s*<li[^>]*><a[^>]*>([^<]+)<\/a><\/li>\s*<\/ul>/i);
        const author = authorMatch ? decodeEntities(authorMatch[0].trim()) : 'Unknown Author';

        const coverMatch = extractFirst(html, /<div class="book">\s*<img[^>]*src="([^"]+)"/i);
        const coverUrl = coverMatch ? (coverMatch[0].startsWith('http') ? coverMatch[0] : BASE_URL + coverMatch[0]) : 'https://via.placeholder.com/150x200?text=No+Cover';

        const descriptionMatch = extractFirst(html, /<div class="desc-text"[^>]*>(.*?)<\/div>/is);
        const description = descriptionMatch ? cleanHtmlText(descriptionMatch[0]) : 'No description available.';

        // Genres: Find links within the genre list structure
        const genres = [];
        const genreListMatch = extractFirst(html, />\s*Genre:\s*<\/label>\s*<ul[^>]*>(.*?)<\/ul>/is);
        if (genreListMatch) {
            const genreRegex = /<a[^>]*>([^<]+)<\/a>/gi;
            const genreMatches = extractAll(genreListMatch[0], genreRegex);
            genreMatches.forEach(match => genres.push(decodeEntities(match[1].trim())));
        }

         // Status: Look for the structure around "Status:"
         const statusMatch = extractFirst(html, />\s*Status:\s*<\/label>\s*<a[^>]*>([^<]+)<\/a>/i);
         const status = statusMatch ? decodeEntities(statusMatch[0].trim()) : 'Unknown';


        // --- Extract Chapters ---
        const chapters = [];
        // Find the chapter list container first (e.g., <div id="list-chapter">...</div>)
         // The site seems to load chapters via AJAX, check network tab in browser dev tools.
         // It calls /ajax/chapter-archive?novelId=XXXX where XXXX is a numerical ID.
         // Let's try to find that numerical ID first.
         const novelIdMatch = extractFirst(html, /data-novel-id="(\d+)"/i)
                           ?? extractFirst(html, /$('#rate').raty\(\{.*?readOnly: true, score: \d+, novelId: (\d+)\}/i); // Alternative pattern

         if (novelIdMatch) {
             const numericalNovelId = novelIdMatch[0];
             const chaptersUrl = `${BASE_URL}/ajax/chapter-archive?novelId=${numericalNovelId}`;
             console.log(`Fetching chapter list from AJAX URL: ${chaptersUrl}`);

             const chaptersResponse = await fetch(chaptersUrl, {
                headers: { // Might need specific headers, check browser request
                    'Referer': bookUrl,
                    'X-Requested-With': 'XMLHttpRequest' // Often needed for AJAX
                }
             });

             if (!chaptersResponse.ok) {
                 console.error(`Failed to fetch AJAX chapters: ${chaptersResponse.status}`);
             } else {
                 const chaptersHtml = await chaptersResponse.text(); // The response IS the HTML list
                 // Regex captures: 1=chapter slug (id), 2=chapter title
                 const chapterRegex = /<li[^>]*>\s*<a href="\/([^"]+)"[^>]*title="[^"]+">\s*([^<]+)\s*<\/a>\s*<\/li>/gi;
                 const chapterMatches = extractAll(chaptersHtml, chapterRegex);

                 for (const match of chapterMatches) {
                     const chapterId = match[1]; // e.g., martial-peak/chapter-1
                     const chapterTitle = decodeEntities(match[2].trim());
                     if (chapterId && chapterTitle) {
                         chapters.push({
                             id: chapterId,
                             title: chapterTitle,
                         });
                     }
                 }
                 // Chapters from AJAX are usually in correct order already.
                 console.log(`Parsed ${chapters.length} chapters from AJAX response.`);
             }
         } else {
            console.warn("Could not find numerical novel ID to fetch chapter list via AJAX for:", id);
            // Fallback: Try parsing the main page if chapters are directly embedded (less likely now)
             const chapterListHtmlMatch = extractFirst(html, /<div id="list-chapter"[^>]*>(.*?)<\/div>/is);
             if(chapterListHtmlMatch) {
                const chapterRegex = /<li[^>]*>\s*<a href="\/([^"]+)"[^>]*title="[^"]+">\s*([^<]+)\s*<\/a>\s*<\/li>/gi;
                const chapterMatches = extractAll(chapterListHtmlMatch[0], chapterRegex);
                 for (const match of chapterMatches) {
                     const chapterId = match[1];
                     const chapterTitle = decodeEntities(match[2].trim());
                     if (chapterId && chapterTitle) {
                         chapters.push({ id: chapterId, title: chapterTitle });
                     }
                 }
                 // Chapters embedded directly might be newest first, check site and reverse if needed.
                  console.log(`Parsed ${chapters.length} chapters from direct HTML (fallback).`);
             }
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
     * @param {string} id - The chapter ID (slug, e.g., martial-peak/chapter-1).
     * @returns {Promise<string>} - The cleaned text content of the chapter.
     */
    async getContent(id) {
      const chapterUrl = `${BASE_URL}/${id}.html`; // Chapters also often end with .html
      console.log(`Fetching content for: ${chapterUrl}`);

      try {
        let response = await fetch(chapterUrl);
         if (!response.ok) {
            const fallbackUrl = `${BASE_URL}/${id}`;
            console.log(`Retrying content fetch without .html: ${fallbackUrl}`);
            response = await fetch(fallbackUrl);
             if (!response.ok) {
                 throw new Error(`Failed to fetch chapter content (tried with and without .html): ${response.status}`);
            }
        }

        const html = await response.text();

        // Regex to find the main content div
        const contentMatch = extractFirst(html, /<div id="chr-content"[^>]*>(.*?)<\/div>/is);

        if (!contentMatch || !contentMatch[0]) {
          console.error("Could not find #chr-content div for chapter:", id);
          throw new Error('Chapter content container not found.');
        }

        // Clean the extracted HTML content
        const content = cleanHtmlText(contentMatch[0]);

        if (!content) {
             console.warn("Extracted content is empty for chapter:", id);
             // Decide whether to throw error or return empty string
             // Let's throw, as empty content is usually unexpected.
             throw new Error('Extracted chapter content is empty.');
        }

        return content; // Return the cleaned text string

      } catch (error) {
        console.error(`Get Content Error for ID ${id}:`, error);
        throw new Error(`Failed to get content for ${id}: ${error.message}`);
      }
    }
  };
};

// Export the module function as the default export
export default readNovelFullModule;
