// Simple voice parser - copy the logic from this file
function parseVoiceText(text) {
  if (!text) return { title: '', description: '' };
  
  // Check for keywords
  const hasDescription = text.toLowerCase().includes('description');
  const hasTitle = text.toLowerCase().includes('title');
  
  if (hasDescription && hasTitle) {
    // Format: "description [text] title [text]"
    if (text.toLowerCase().indexOf('description') < text.toLowerCase().indexOf('title')) {
      const descriptionStart = text.toLowerCase().indexOf('description') + 'description'.length;
      const titleStart = text.toLowerCase().indexOf('title');
      
      const description = text.substring(descriptionStart, titleStart).trim();
      const title = text.substring(titleStart + 'title'.length).trim();
      
      return { title, description };
    } 
    // Format: "title [text] description [text]"
    else {
      const titleStart = text.toLowerCase().indexOf('title') + 'title'.length;
      const descriptionStart = text.toLowerCase().indexOf('description');
      
      const title = text.substring(titleStart, descriptionStart).trim();
      const description = text.substring(descriptionStart + 'description'.length).trim();
      
      return { title, description };
    }
  }
  
  // If there's no structured format, return the whole text as title
  return { title: text, description: '' };
}

// Example usage:
/*
const result = parseVoiceText("description study algebra title study mathematics");
console.log(result);
// Should output: { title: 'study mathematics', description: 'study algebra' }
*/
