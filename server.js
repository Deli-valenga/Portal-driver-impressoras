require('dotenv').config();

const express = require('express');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const app = express();

const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// SERVIR ARQUIVOS HTML/CSS/JS
app.use(express.static(__dirname));

// SUPABASE
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

// ============================================
// GET DRIVERS
// ============================================
app.get('/tables/drivers', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('drivers')
      .select('*')
      .order('nome', { ascending: true });

    if (error) {
      console.error(error);
      return res.status(500).json({ error: error.message });
    }

    res.json({ data });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao buscar drivers' });
  }
});

// ============================================
// CRIAR DRIVER
// ============================================
app.post('/tables/drivers', async (req, res) => {
  try {

    const payload = {
      nome: req.body.nome,
      marca: req.body.marca,
      modelo: req.body.modelo || '',
      sistema_operacional: req.body.sistema_operacional || '',
      versao: req.body.versao || '',
      link_download: req.body.link_download || '',
      descricao: req.body.descricao || '',
      ativo: req.body.ativo !== false
    };

    const { data, error } = await supabase
      .from('drivers')
      .insert([payload])
      .select()
      .single();

    if (error) {
      console.error(error);
      return res.status(500).json({ error: error.message });
    }

    res.json(data);

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao criar driver' });
  }
});

// ============================================
// EDITAR DRIVER
// ============================================
app.put('/tables/drivers/:id', async (req, res) => {
  try {

    const { id } = req.params;

    const payload = {
      nome: req.body.nome,
      marca: req.body.marca,
      modelo: req.body.modelo || '',
      sistema_operacional: req.body.sistema_operacional || '',
      versao: req.body.versao || '',
      link_download: req.body.link_download || '',
      descricao: req.body.descricao || '',
      ativo: req.body.ativo !== false
    };

    const { data, error } = await supabase
      .from('drivers')
      .update(payload)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error(error);
      return res.status(500).json({ error: error.message });
    }

    res.json(data);

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao editar driver' });
  }
});

// ============================================
// EXCLUIR DRIVER
// ============================================
app.delete('/tables/drivers/:id', async (req, res) => {
  try {

    const { id } = req.params;

    const { error } = await supabase
      .from('drivers')
      .delete()
      .eq('id', id);

    if (error) {
      console.error(error);
      return res.status(500).json({ error: error.message });
    }

    res.status(204).send();

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao excluir driver' });
  }
});

// ============================================
// ROTA PRINCIPAL
// ============================================
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// ============================================
// START
// ============================================
app.listen(PORT, () => {
  console.log(`Servidor rodando em http://localhost:${PORT}`);
});