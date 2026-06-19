// ============================================================
// Cloudinary — Upload de Imagens (Unsigned Preset)
// ============================================================
const Cloudinary = {
  CLOUD_NAME: 'doitrywwr',
  UPLOAD_PRESET: 'golrila_products',
  UPLOAD_URL: 'https://api.cloudinary.com/v1_1/doitrywwr/image/upload',

  /**
   * Faz upload de um arquivo de imagem para o Cloudinary.
   * @param {File}     file        - O arquivo de imagem a enviar
   * @param {Function} onProgress  - Callback opcional: recebe porcentagem (0-100)
   * @returns {Promise<string>}    - URL segura (https) da imagem hospedada
   */
  upload: (file, onProgress = null) => {
    return new Promise((resolve, reject) => {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('upload_preset', Cloudinary.UPLOAD_PRESET);
      formData.append('folder', 'estoque');

      const xhr = new XMLHttpRequest();

      // Progresso do upload
      if (onProgress) {
        xhr.upload.addEventListener('progress', (e) => {
          if (e.lengthComputable) {
            const pct = Math.round((e.loaded / e.total) * 100);
            onProgress(pct);
          }
        });
      }

      xhr.addEventListener('load', () => {
        if (xhr.status === 200) {
          try {
            const data = JSON.parse(xhr.responseText);
            resolve(data.secure_url);
          } catch {
            reject(new Error('Resposta inválida do Cloudinary.'));
          }
        } else {
          let msg = 'Falha no upload da imagem.';
          try {
            const err = JSON.parse(xhr.responseText);
            if (err?.error?.message) msg = err.error.message;
          } catch { /* ignora */ }
          reject(new Error(msg));
        }
      });

      xhr.addEventListener('error', () => reject(new Error('Erro de rede ao enviar imagem.')));
      xhr.addEventListener('abort', () => reject(new Error('Upload cancelado.')));

      xhr.open('POST', Cloudinary.UPLOAD_URL);
      xhr.send(formData);
    });
  },
};
