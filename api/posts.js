module.exports = async (req, res) => {
  if (req.method === 'DELETE') {
    return handleDelete(req, res);
  }
  if (req.method === 'PUT') {
    return handleEdit(req, res);
  }
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const { password, category, content, imageData } = req.body || {};

    if (!password || password !== process.env.WRITE_PASSWORD) {
      res.status(401).json({ error: '비밀번호가 올바르지 않습니다.' });
      return;
    }
    if (!category || !content || !content.trim()) {
      res.status(400).json({ error: '카테고리와 내용을 입력해주세요.' });
      return;
    }
    if (!['notice', 'community', 'review', 'archive'].includes(category)) {
      res.status(400).json({ error: '올바르지 않은 카테고리입니다.' });
      return;
    }

    const owner = process.env.GITHUB_OWNER;
    const repo = process.env.GITHUB_REPO;
    const branch = process.env.GITHUB_BRANCH || 'main';
    const token = process.env.GITHUB_TOKEN;

    // 0) 이미지가 첨부된 경우, 별도 파일로 먼저 업로드
    let imagePath = null;
    if (imageData && typeof imageData === 'string' && imageData.startsWith('data:image')) {
      const match = imageData.match(/^data:image\/(\w+);base64,(.+)$/);
      if (match) {
        const ext = match[1] === 'jpeg' ? 'jpg' : match[1];
        const base64Body = match[2];
        // 대략적인 용량 체크 (base64는 원본보다 약 37% 큼)
        const approxBytes = base64Body.length * 0.75;
        if (approxBytes > 3 * 1024 * 1024) {
          res.status(400).json({ error: '이미지 용량이 너무 큽니다. 더 작은 사진으로 시도해주세요.' });
          return;
        }
        imagePath = `images/${Date.now()}.${ext}`;
        const imgApiUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${imagePath}`;
        const imgPutRes = await fetch(imgApiUrl, {
          method: 'PUT',
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: 'application/vnd.github+json'
          },
          body: JSON.stringify({
            message: '이미지 업로드',
            content: base64Body,
            branch
          })
        });
        if (!imgPutRes.ok) {
          const errText = await imgPutRes.text();
          throw new Error('이미지 업로드 실패: ' + errText);
        }
      }
    }

    const filePath = 'posts.json';
    const apiUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${filePath}`;

    // 1) 현재 posts.json 읽기
    const getRes = await fetch(`${apiUrl}?ref=${branch}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json'
      }
    });
    if (!getRes.ok) {
      throw new Error('GitHub 파일 조회 실패 (' + getRes.status + ')');
    }
    const getData = await getRes.json();
    const currentPosts = JSON.parse(
      Buffer.from(getData.content, 'base64').toString('utf-8')
    );

    // 2) 새 글 추가
    const newPost = {
      id: Date.now(),
      category,
      content: content.trim(),
      date: new Date().toISOString(),
      views: 0,
      image: imagePath
    };
    const updatedPosts = [newPost, ...currentPosts];

    const newContentBase64 = Buffer.from(
      JSON.stringify(updatedPosts, null, 2)
    ).toString('base64');

    // 3) GitHub에 커밋 (자동으로 Vercel 재배포 트리거됨)
    const putRes = await fetch(apiUrl, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json'
      },
      body: JSON.stringify({
        message: `새 글 추가 (${category})`,
        content: newContentBase64,
        sha: getData.sha,
        branch
      })
    });

    if (!putRes.ok) {
      const errText = await putRes.text();
      throw new Error('GitHub 저장 실패: ' + errText);
    }

    res.status(200).json({
      success: true,
      message: '저장되었습니다. 30초~1분 후 사이트에 반영됩니다.'
    });
  } catch (err) {
    res.status(500).json({ error: err.message || '알 수 없는 오류가 발생했습니다.' });
  }
};

async function handleEdit(req, res) {
  try {
    const { password, id, category, content, imageData, removeImage } = req.body || {};

    if (!password || password !== process.env.WRITE_PASSWORD) {
      res.status(401).json({ error: '비밀번호가 올바르지 않습니다.' });
      return;
    }
    if (!id) {
      res.status(400).json({ error: '수정할 글 정보가 없습니다.' });
      return;
    }
    if (!content || !content.trim()) {
      res.status(400).json({ error: '내용을 입력해주세요.' });
      return;
    }
    if (category && !['notice', 'community', 'review', 'archive'].includes(category)) {
      res.status(400).json({ error: '올바르지 않은 카테고리입니다.' });
      return;
    }

    const owner = process.env.GITHUB_OWNER;
    const repo = process.env.GITHUB_REPO;
    const branch = process.env.GITHUB_BRANCH || 'main';
    const token = process.env.GITHUB_TOKEN;

    // 새 이미지가 첨부된 경우 먼저 업로드
    let newImagePath = undefined;
    if (imageData && typeof imageData === 'string' && imageData.startsWith('data:image')) {
      const match = imageData.match(/^data:image\/(\w+);base64,(.+)$/);
      if (match) {
        const ext = match[1] === 'jpeg' ? 'jpg' : match[1];
        const base64Body = match[2];
        const approxBytes = base64Body.length * 0.75;
        if (approxBytes > 3 * 1024 * 1024) {
          res.status(400).json({ error: '이미지 용량이 너무 큽니다. 더 작은 사진으로 시도해주세요.' });
          return;
        }
        newImagePath = `images/${Date.now()}.${ext}`;
        const imgApiUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${newImagePath}`;
        const imgPutRes = await fetch(imgApiUrl, {
          method: 'PUT',
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: 'application/vnd.github+json'
          },
          body: JSON.stringify({
            message: '이미지 업로드 (수정)',
            content: base64Body,
            branch
          })
        });
        if (!imgPutRes.ok) {
          const errText = await imgPutRes.text();
          throw new Error('이미지 업로드 실패: ' + errText);
        }
      }
    }

    const filePath = 'posts.json';
    const apiUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${filePath}`;

    const getRes = await fetch(`${apiUrl}?ref=${branch}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json'
      }
    });
    if (!getRes.ok) {
      throw new Error('GitHub 파일 조회 실패 (' + getRes.status + ')');
    }
    const getData = await getRes.json();
    const currentPosts = JSON.parse(
      Buffer.from(getData.content, 'base64').toString('utf-8')
    );

    const idx = currentPosts.findIndex(p => String(p.id) === String(id));
    if (idx === -1) {
      res.status(404).json({ error: '해당 글을 찾을 수 없습니다.' });
      return;
    }

    const existing = currentPosts[idx];
    const updatedPost = {
      ...existing,
      category: category || existing.category,
      content: content.trim(),
      editedAt: new Date().toISOString()
    };

    if (newImagePath) {
      updatedPost.image = newImagePath;
    } else if (removeImage) {
      updatedPost.image = null;
    }

    currentPosts[idx] = updatedPost;

    const newContentBase64 = Buffer.from(
      JSON.stringify(currentPosts, null, 2)
    ).toString('base64');

    const putRes = await fetch(apiUrl, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json'
      },
      body: JSON.stringify({
        message: `글 수정 (id: ${id})`,
        content: newContentBase64,
        sha: getData.sha,
        branch
      })
    });

    if (!putRes.ok) {
      const errText = await putRes.text();
      throw new Error('GitHub 저장 실패: ' + errText);
    }

    res.status(200).json({
      success: true,
      message: '수정되었습니다. 30초~1분 후 사이트에 반영됩니다.'
    });
  } catch (err) {
    res.status(500).json({ error: err.message || '알 수 없는 오류가 발생했습니다.' });
  }
}

async function handleDelete(req, res) {
  try {
    const { password, id } = req.body || {};

    if (!password || password !== process.env.WRITE_PASSWORD) {
      res.status(401).json({ error: '비밀번호가 올바르지 않습니다.' });
      return;
    }
    if (!id) {
      res.status(400).json({ error: '삭제할 글 정보가 없습니다.' });
      return;
    }

    const owner = process.env.GITHUB_OWNER;
    const repo = process.env.GITHUB_REPO;
    const branch = process.env.GITHUB_BRANCH || 'main';
    const token = process.env.GITHUB_TOKEN;
    const filePath = 'posts.json';
    const apiUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${filePath}`;

    const getRes = await fetch(`${apiUrl}?ref=${branch}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json'
      }
    });
    if (!getRes.ok) {
      throw new Error('GitHub 파일 조회 실패 (' + getRes.status + ')');
    }
    const getData = await getRes.json();
    const currentPosts = JSON.parse(
      Buffer.from(getData.content, 'base64').toString('utf-8')
    );

    const updatedPosts = currentPosts.filter(p => String(p.id) !== String(id));

    if (updatedPosts.length === currentPosts.length) {
      res.status(404).json({ error: '해당 글을 찾을 수 없습니다.' });
      return;
    }

    const newContentBase64 = Buffer.from(
      JSON.stringify(updatedPosts, null, 2)
    ).toString('base64');

    const putRes = await fetch(apiUrl, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json'
      },
      body: JSON.stringify({
        message: `글 삭제 (id: ${id})`,
        content: newContentBase64,
        sha: getData.sha,
        branch
      })
    });

    if (!putRes.ok) {
      const errText = await putRes.text();
      throw new Error('GitHub 삭제 실패: ' + errText);
    }

    res.status(200).json({
      success: true,
      message: '삭제되었습니다. 30초~1분 후 사이트에 반영됩니다.'
    });
  } catch (err) {
    res.status(500).json({ error: err.message || '알 수 없는 오류가 발생했습니다.' });
  }
}
