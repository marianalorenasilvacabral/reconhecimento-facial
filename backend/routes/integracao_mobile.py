"""Análise facial para a API Node. A chave fica apenas nos servidores locais."""
import base64
import hmac
import io
import os

from fastapi import APIRouter, Depends, File, HTTPException, Request, UploadFile
from PIL import Image

from services.acesso import somente_local
from services.processamento_imagem import TAMANHO_MAX_BYTES, ImagemInvalida, validar_imagem
from services.reconhecimento import MODELO, ProblemaNaFoto, abrir_imagem, obter_servico_facial, verificar_consistencia


def autorizar_integracao(request: Request):
    esperado = os.getenv('MOBILE_INTEGRATION_SECRET', '')
    recebido = request.headers.get('x-integration-key', '')
    if not esperado or not recebido or not hmac.compare_digest(esperado, recebido):
        raise HTTPException(403, 'Integração não autorizada.')


router = APIRouter(prefix='/integracao', tags=['integracao mobile'], dependencies=[Depends(somente_local), Depends(autorizar_integracao)])


@router.post('/analisar-fotos')
def analisar_fotos(fotos: list[UploadFile] = File(...), servico=Depends(obter_servico_facial)):
    if len(fotos) != 5:
        raise HTTPException(422, 'Envie exatamente cinco fotos.')
    resultado, vetores = [], []
    for indice, foto in enumerate(fotos, start=1):
        conteudo = foto.file.read(TAMANHO_MAX_BYTES + 1)
        try:
            tipo = validar_imagem(conteudo)
            vetor = servico.extrair_unico(conteudo)
            vetores.append(vetor)
            miniatura = None
            if indice == 1:
                imagem = Image.fromarray(abrir_imagem(conteudo, 160))
                arquivo = io.BytesIO()
                imagem.save(arquivo, 'JPEG', quality=65)
                miniatura = 'data:image/jpeg;base64,' + base64.b64encode(arquivo.getvalue()).decode('ascii')
            resultado.append({'tipo_mime': tipo, 'vetor': vetor.tolist(), 'modelo': MODELO, 'miniatura': miniatura})
        except (ImagemInvalida, ProblemaNaFoto) as erro:
            raise HTTPException(422, f'Foto {indice}: {erro}')
    try:
        verificar_consistencia(vetores)
    except ProblemaNaFoto as erro:
        raise HTTPException(422, str(erro))
    return {'fotos': resultado}
