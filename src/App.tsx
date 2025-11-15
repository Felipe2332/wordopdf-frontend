import React, { useState, useCallback } from 'react';
import type { DragEvent } from 'react';
import { UploadCloud, FileText, X, Loader2 } from 'lucide-react';

// URL da sua API (onde o Docker está rodando)
const API_URL = import.meta.env.VITE_API_URL;
const MAX_FILES = 30;

// Tipo para o status da UI
type StatusState = {
    message: string;
    type: 'error' | 'success' | 'idle';
};

/**
 * Componente principal do App
 */
export default function App() {
    // Estado para os arquivos
    const [files, setFiles] = useState<File[]>([]);
    // Estado para carregamento
    const [isLoading, setIsLoading] = useState(false);
    // Estado para mensagens de status e erro
    const [status, setStatus] = useState<StatusState>({ message: '', type: 'idle' });
    // Estado para feedback visual de 'arrastar sobre'
    const [isDragging, setIsDragging] = useState(false);

    /**
     * Adiciona arquivos à lista, evitando duplicatas
     */
    const addFiles = (newFiles: FileList) => {
        setStatus({ message: '', type: 'idle' });

        // --- MODIFICADO ---
        // 2. Verifica se a lista JÁ ESTÁ CHEIA antes de começar
        if (files.length >= MAX_FILES) {
            setStatus({ message: `Você já atingiu o limite de ${MAX_FILES} arquivos.`, type: 'error' });
            return;
        }

        const filesToAdd: File[] = [];
        let limitReached = false; // Flag para controlar a mensagem
        
        Array.from(newFiles).forEach(file => {
            // --- NOVO ---
            // 3. Verifica se o limite foi atingido DENTRO do loop
            if (files.length + filesToAdd.length >= MAX_FILES) {
                limitReached = true;
                return; // Para de adicionar mais arquivos
            }

            const isDocx = file.name.endsWith('.docx') || file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
            const isDuplicate = files.some(f => f.name === file.name && f.size === file.size);
            
            if (isDocx && !isDuplicate) {
                filesToAdd.push(file);
            }
        });

        // --- NOVO ---
        // 4. Mostra a mensagem de limite se ela foi ativada
        if (limitReached && filesToAdd.length > 0) {
             setStatus({ message: `Limite de ${MAX_FILES} arquivos atingido. ${filesToAdd.length} arquivo(s) foram adicionados.`, type: 'error' });
        } else if (limitReached) {
             setStatus({ message: `Limite de ${MAX_FILES} arquivos atingido. Nenhum arquivo novo foi adicionado.`, type: 'error' });
        }
        
        setFiles(prevFiles => [...prevFiles, ...filesToAdd]);
    };

    /**
     * Remove um arquivo da lista pelo seu índice
     */
    const removeFile = (index: number) => {
        setFiles(prevFiles => prevFiles.filter((_, i) => i !== index));
    };

    /**
     * Limpa todos os arquivos
     */
    const clearAll = () => {
        setFiles([]);
        setStatus({ message: '', type: 'idle' });
    };

    /**
     * Manipulador para o evento 'drop' (soltar)
     */
    const handleDrop = useCallback((e: DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
        addFiles(e.dataTransfer.files);
    }, [files]); // Depende de 'files' para evitar duplicatas

    /**
     * Manipulador para 'dragOver'
     */
    const handleDragOver = useCallback((e: DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(true);
    }, []);

    /**
     * Manipulador para 'dragLeave'
     */
    const handleDragLeave = useCallback((e: DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
    }, []);

    /**
     * Manipulador para o input de arquivo (clique)
     */
    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            addFiles(e.target.files);
        }
    };

    // ====================================================================
    // --- FUNÇÃO MODIFICADA ---
    // ====================================================================
    /**
     * Manipulador para o envio do formulário (botão Converter)
     */
    const handleSubmit = async () => {
        if (files.length === 0) {
            // --- MENSAGEM MODIFICADA ---
            setStatus({ message: 'Opa! Você precisa selecionar um arquivo .docx primeiro.', type: 'error' });
            return;
        }

        setIsLoading(true);
        setStatus({ message: '', type: 'idle' });

        const formData = new FormData();
        files.forEach(file => {
            formData.append('files', file);
        });

        try {
            const response = await fetch(API_URL, {
                method: 'POST',
                body: formData,
            });

            if (!response.ok) {
                // Se o servidor deu erro (500, etc.)
                const errorText = await response.text(); // Ainda é bom logar para você
                console.error("Erro do servidor:", errorText);
                
                // --- MENSAGEM MODIFICADA ---
                // Em vez de mostrar o erro, joga um erro "genérico"
                throw new Error('server_error'); 
            }

            // Sucesso! Processar o download do .zip
            const blob = await response.blob();
            
            let filename = 'converted-files.zip';
            const contentDisposition = response.headers.get('content-disposition');
            if (contentDisposition) {
                const filenameMatch = contentDisposition.match(/filename="(.+?)"/);
                if (filenameMatch && filenameMatch.length > 1) {
                    filename = filenameMatch[1];
                }
            }
            
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.style.display = 'none';
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            
            window.URL.revokeObjectURL(url);
            a.remove();
            
            // --- MENSAGEM MODIFICADA (um pouco mais amigável) ---
            setStatus({ message: 'Prontinho! ✨ Conversão concluída, seu download vai começar.', type: 'success' });
            clearAll(); // Limpa o formulário

        } catch (error: any) {
            console.error('Erro na conversão:', error); // Mantenha isso para seu debug
            
            // --- LÓGICA DE ERRO MODIFICADA ---
            if (error.message.includes('Failed to fetch')) {
                // Erro de rede (servidor offline, CORS, etc.)
                setStatus({ 
                    message: 'Opa! Não consegui conectar ao servidor. Tente de novo daqui a pouco.', 
                    type: 'error' 
                });
            } else if (error.message === 'server_error') {
                // Erro que jogamos acima (falha na conversão, 500)
                setStatus({ 
                    message: 'Ih, deu um probleminha no servidor ao tentar converter. Tente novamente!', 
                    type: 'error' 
                });
            } else {
                // Outro erro inesperado
                setStatus({ 
                    message: 'Ocorreu um erro inesperado. Por favor, tente de novo.', 
                    type: 'error' 
                });
            }
        } finally {
            setIsLoading(false);
        }
    };
    // ====================================================================
    // --- FIM DA FUNÇÃO MODIFICADA ---
    // ====================================================================


    return (
        <div className="flex items-center justify-center min-h-screen bg-gray-700 font-sans">
            <div className="bg-white w-full max-w-2xl p-8 rounded-xl shadow-lg m-4">
                
                <h1 className="text-3xl font-bold text-center text-gray-800 mb-6">
                    Converter DOCX para PDF
                </h1>
                <h3 className="text-xl font-bold text-center text-gray-400 mb-6">
                    Conversões de 30 arquivos podem demorar até 5 minutos
                </h3>
                
                {/* Zona de Arrastar e Soltar (Dropzone) */}
                <div
                    id="drop-zone"
                    onDrop={handleDrop}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    className={`flex flex-col items-center justify-center w-full h-64 border-2 border-dashed rounded-lg cursor-pointer bg-gray-50 transition-all duration-300
                        ${isDragging ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:bg-gray-100'}
                    `}
                >
                    <label htmlFor="file-upload" className="flex flex-col items-center justify-center w-full h-full cursor-pointer">
                        <UploadCloud className={`w-10 h-10 mb-3 ${isDragging ? 'text-blue-500' : 'text-gray-400'}`} />
                        <p className="mb-2 text-sm text-gray-500">
                            <span className="font-semibold">Clique para enviar</span> ou arraste e solte
                        </p>
                        <p className="text-xs text-gray-500">Arquivos .DOCX (limite de 30)</p>
                    </label>
                    <input
                        id="file-upload"
                        type="file"
                        className="hidden"
                        multiple
                        accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                        onChange={handleFileChange}
                        disabled={isLoading}
                    />
                </div>

                {/* Lista de Arquivos Selecionados */}
                {files.length > 0 && (
                    <div id="file-list-container" className="mt-6">
                        <h3 className="text-lg font-semibold text-gray-700 mb-3">Arquivos Selecionados:</h3>
                        <ul id="file-list" className="space-y-2 max-h-40 overflow-y-auto pr-2">
                            {files.map((file, index) => (
                                <li key={index} className="flex items-center justify-between bg-gray-100 p-2 rounded-lg group">
                                    <div className="flex items-center space-x-2 overflow-hidden">
                                        <FileText className="w-5 h-5 text-blue-500" />
                                        <span className="text-sm text-gray-800 truncate" title={file.name}>
                                            {file.name}
                                        </span>
                                    </div>
                                    <button 
                                        onClick={() => removeFile(index)} 
                                        className="text-gray-400 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100 disabled:opacity-50"
                                        disabled={isLoading}
                                    >
                                        <X className="w-5 h-5" />
                                    </button>
                                </li>
                            ))}
                        </ul>
                    </div>
                )}

                {/* Mensagens de Status/Erro */}
                {status.type !== 'idle' && (
                    <div id="status-message" className={`mt-4 text-center p-3 rounded-lg ${
                        status.type === 'error' ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'
                    }`}>
                        {status.message}
                    </div>
                )}

                {/* Botões de Ação */}
                <div className={`mt-8 flex gap-4 ${files.length === 0 ? 'hidden' : ''}`}>
                    <button 
                        id="convert-button" 
                        onClick={handleSubmit}
                        disabled={isLoading || files.length === 0}
                        className="flex-1 w-full bg-blue-600 text-white font-bold py-3 px-6 rounded-lg hover:bg-blue-700 transition duration-300 shadow-md disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center"
                    >
                        {isLoading ? (
                            <Loader2 className="w-6 h-6 animate-spin" />
                        ) : (
                            <span>Converter {files.length} Arquivo(s)</span>
                        )}
                    </button>
                    <button 
                        id="clear-button" 
                        onClick={clearAll}
                        disabled={isLoading}
                        className="flex-none bg-gray-200 text-gray-700 font-semibold py-3 px-6 rounded-lg hover:bg-gray-300 transition duration-300 disabled:opacity-50"
                    >
                        Limpar
                    </button>
                </div>

            </div>
        </div>
    );
}