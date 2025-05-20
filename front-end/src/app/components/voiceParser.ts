/**
 * Parses voice input to extract title and description
 */
export function parseVoiceInput(voiceText: string): { title: string; description: string } {
  // Default empty values
  let title = '';
  let description = '';
  
  if (!voiceText) {
    return { title, description };
  }
  
  // Check if the text contains both keywords
  const hasDescription = voiceText.toLowerCase().includes('description');
  const hasTitle = voiceText.toLowerCase().includes('title');
  
  if (hasDescription && hasTitle) {
    // Format: "description [text] title [text]"
    if (voiceText.toLowerCase().indexOf('description') < voiceText.toLowerCase().indexOf('title')) {
      const descriptionStart = voiceText.toLowerCase().indexOf('description') + 'description'.length;
      const titleStart = voiceText.toLowerCase().indexOf('title');
      
      description = voiceText.substring(descriptionStart, titleStart).trim();
      title = voiceText.substring(titleStart + 'title'.length).trim();
    } 
    // Format: "title [text] description [text]"
    else {
      const titleStart = voiceText.toLowerCase().indexOf('title') + 'title'.length;
      const descriptionStart = voiceText.toLowerCase().indexOf('description');
      
      title = voiceText.substring(titleStart, descriptionStart).trim();
      description = voiceText.substring(descriptionStart + 'description'.length).trim();
    }
    return { title, description };
  } 
  
  // If only one or none of the keywords found, return the full text as title
  return { 
    title: voiceText, 
    description: ''
  };
}
