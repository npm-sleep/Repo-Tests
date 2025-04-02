const BASE_URL = 'https://readnovelfull.com';

// Search function
export async function search(query, fetch) {
  try {
    const searchUrl = `${BASE_URL}/novel-list/search?keyword=${encodeURIComponent(query)}`;
    const response = await fetch(searchUrl);
    const html = await response.text();
    
    // Parse the HTML to extract search results
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    
    const results = [];
    const novelElements = doc.querySelectorAll('#list-page .list-novel .row');
    
    novelElements.forEach(element => {
      const titleElement = element.querySelector('.novel-title');
      const authorElement = element.querySelector('.author');
      const coverElement = element.querySelector('.novel-cover img');
      const descriptionElement = element.querySelector('.novel-desc');
      
      if (titleElement) {
        const title = titleElement.textContent.trim();
        const link = titleElement.getAttribute('href');
        const id = link ? link.split('/').pop() : '';
        
        results.push({
          id,
          title,
          author: authorElement ? authorElement.textContent.trim() : 'Unknown Author',
          coverUrl: coverElement ? coverElement.getAttribute('src') : 'https://via.placeholder.com/150x200?text=No+Cover',
          description: descriptionElement ? descriptionElement.textContent.trim() : 'No description available'
        });
      }
    });
    
    return results;
  } catch (error) {
    console.error('Search error:', error);
    return [];
  }
}

// Get book details function
export async function getBookDetails(id, fetch) {
  try {
    const bookUrl = `${BASE_URL}/${id}`;
    const response = await fetch(bookUrl);
    const html = await response.text();
    
    // Parse the HTML to extract book details
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    
    const titleElement = doc.querySelector('.title');
    const authorElement = doc.querySelector('.author');
    const coverElement = doc.querySelector('.book img');
    const descriptionElement = doc.querySelector('.desc-text');
    
    if (!titleElement) {
      throw new Error('Book not found');
    }
    
    return {
      id,
      title: titleElement.textContent.trim(),
      author: authorElement ? authorElement.textContent.trim() : 'Unknown Author',
      coverUrl: coverElement ? coverElement.getAttribute('src') : 'https://via.placeholder.com/150x200?text=No+Cover',
      description: descriptionElement ? descriptionElement.textContent.trim() : 'No description available'
    };
  } catch (error) {
    console.error('Get book details error:', error);
    throw new Error('Failed to fetch book details');
  }
}

// Get content function
export async function getContent(id, fetch) {
  try {
    const chapterUrl = `${BASE_URL}/${id}`;
    const response = await fetch(chapterUrl);
    const html = await response.text();
    
    // Parse the HTML to extract chapter content
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    
    const contentElement = doc.querySelector('#chr-content');
    
    if (!contentElement) {
      throw new Error('Chapter content not found');
    }
    
    // Clean up the content
    const content = contentElement.innerHTML
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<[^>]*>/g, '')
      .replace(/&nbsp;/g, ' ')
      .trim();
    
    return content;
  } catch (error) {
    console.error('Get content error:', error);
    throw new Error('Failed to fetch book content');
  }
}

// Get chapter list function
export async function getChapterList(id, fetch) {
  try {
    const bookUrl = `${BASE_URL}/${id}`;
    const response = await fetch(bookUrl);
    const html = await response.text();
    
    // Parse the HTML to extract chapter list
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    
    const chapters = [];
    const chapterElements = doc.querySelectorAll('#chapter-list a');
    
    chapterElements.forEach(element => {
      const title = element.textContent.trim();
      const link = element.getAttribute('href');
      const chapterId = link ? link.split('/').pop() : '';
      
      if (chapterId) {
        chapters.push({
          id: chapterId,
          title
        });
      }
    });
    
    return chapters;
  } catch (error) {
    console.error('Get chapter list error:', error);
    return [];
  }
} 